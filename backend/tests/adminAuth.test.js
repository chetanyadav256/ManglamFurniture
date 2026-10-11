import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import Admin from '../src/models/Admin.js';
import { env } from '../src/config/env.js';

const adminId = '507f1f77bcf86cd799439011';
const testSecret = 'local-test-only-secret-7c9f!A2bD4eG6hJ8';
const password = 'correct-test-password';
const passwordHash = bcrypt.hashSync(password, 4);
let admin, server, base;

function queryForAdmin(getAdmin) {
  return {
    select() {
      return {
        lean: async () => getAdmin(),
      };
    },
  };
}

before(async () => {
  env.jwtSecret = testSecret;
  env.jwtExpiresIn = '1h';
  mock.method(Admin, 'findOne', () => queryForAdmin(() => admin));
  mock.method(Admin, 'findById', () => queryForAdmin(() => admin));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(() => {
  admin = {
    _id: adminId,
    name: 'Furniture Admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    passwordHash,
  };
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  mock.restoreAll();
  env.jwtSecret = '';
  env.jwtExpiresIn = '1d';
});

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: token.startsWith('raw:') ? token.slice(4) : `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

function tokenFor(overrides = {}, options = {}) {
  return jwt.sign({ sub: adminId, ...overrides }, testSecret, {
    algorithm: 'HS256',
    expiresIn: options.expiresIn ?? '1h',
  });
}

test('Correct login returns a token and only the safe admin profile', async () => {
  const { status, body } = await request('/admin/login', {
    method: 'POST',
    body: { email: ' ADMIN@Example.com ', password },
  });
  assert.equal(status, 200);
  assert.deepEqual(body.admin, {
    id: adminId,
    name: 'Furniture Admin',
    email: 'admin@example.com',
    role: 'admin',
  });
  assert.equal(typeof body.token, 'string');
  assert.equal(JSON.stringify(body).includes(password), false);
  assert.equal(JSON.stringify(body).includes(passwordHash), false);
});

test('Wrong password, unknown email, and inactive admins receive the same generic error', async () => {
  const wrongPassword = await request('/admin/login', {
    method: 'POST',
    body: { email: admin.email, password: 'wrong-password' },
  });
  admin = null;
  const unknownEmail = await request('/admin/login', {
    method: 'POST',
    body: { email: 'unknown@example.com', password },
  });
  admin = { _id: adminId, name: 'Furniture Admin', email: 'admin@example.com', role: 'admin', isActive: false, passwordHash };
  const inactive = await request('/admin/login', {
    method: 'POST',
    body: { email: admin.email, password },
  });
  assert.deepEqual([wrongPassword.status, unknownEmail.status, inactive.status], [401, 401, 401]);
  assert.deepEqual(wrongPassword.body, { message: 'Invalid email or password.' });
  assert.deepEqual(unknownEmail.body, wrongPassword.body);
  assert.deepEqual(inactive.body, wrongPassword.body);
});

test('Malformed or missing login values are rejected', async () => {
  for (const body of [{}, { email: 'not-an-email', password }, { email: admin.email }, { email: admin.email, password: '' }]) {
    const result = await request('/admin/login', { method: 'POST', body });
    assert.equal(result.status, 400);
  }
});

test('Current-admin endpoint rejects missing, malformed, invalid, and expired tokens', async () => {
  const missing = await request('/admin/me');
  const malformed = await request('/admin/me', { token: 'raw:Basic abc' });
  const invalid = await request('/admin/me', { token: 'not-a-jwt' });
  const expired = await request('/admin/me', { token: tokenFor({}, { expiresIn: -1 }) });
  assert.deepEqual([missing.status, malformed.status, invalid.status, expired.status], [401, 401, 401, 401]);
});

test('Valid token returns the current safe profile and rechecks active status', async () => {
  const valid = await request('/admin/me', { token: tokenFor() });
  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body.admin, {
    id: adminId,
    name: 'Furniture Admin',
    email: 'admin@example.com',
    role: 'admin',
  });
  assert.equal(JSON.stringify(valid.body).includes(passwordHash), false);

  admin.isActive = false;
  const inactive = await request('/admin/me', { token: tokenFor() });
  assert.equal(inactive.status, 401);
});

test('An authenticated account without the required admin role is forbidden', async () => {
  admin.role = 'editor';
  const result = await request('/admin/me', { token: tokenFor() });
  assert.equal(result.status, 403);
});

test('No public registration endpoint exists and public health remains accessible', async () => {
  assert.equal((await request('/admin/register', { method: 'POST', body: {} })).status, 404);
  assert.equal((await request('/health')).status, 200);
});
