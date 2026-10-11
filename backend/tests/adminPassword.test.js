import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import Admin from '../src/models/Admin.js';
import { env } from '../src/config/env.js';

const id = '507f1f77bcf86cd799439011';
const secret = 'isolated-password-tests-only-9382!AbCd';
const currentPassword = 'original-test-password';
const newPassword = 'replacement-test-password';
const initialHash = bcrypt.hashSync(currentPassword, 4);
let admin, server, base, writes, failWrite, forceConflict, clock;
const realNow = Date.now.bind(Date);
const savedEnv = { jwtSecret: env.jwtSecret, jwtExpiresIn: env.jwtExpiresIn };
const query = () => ({ select: () => ({ lean: async () => admin ? { ...admin } : null }) });

before(async () => {
  env.jwtSecret = secret;
  env.jwtExpiresIn = '1h';
  clock = realNow();
  mock.method(Date, 'now', () => clock);
  mock.method(Admin, 'findById', (accountId) => { assert.equal(String(accountId), id); return query(); });
  mock.method(Admin, 'findOne', query);
  mock.method(Admin, 'updateOne', async (filter, update, options) => {
    assert.equal(filter._id, id);
    assert.equal(filter.isActive, true);
    assert.deepEqual(filter.role, { $in: ['admin', 'superadmin'] });
    assert.deepEqual(Object.keys(update), ['$set', '$inc']);
    assert.deepEqual(Object.keys(update.$set), ['passwordHash']);
    assert.deepEqual(update.$inc, { tokenVersion: 1 });
    assert.deepEqual(options, { runValidators: true });
    if (failWrite) throw new Error('Private database detail');
    const versionMatches = filter.$or
      ? (assert.deepEqual(filter.$or, [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }]), (admin.tokenVersion ?? 0) === 0)
      : admin.tokenVersion === filter.tokenVersion;
    if (forceConflict || !versionMatches || filter.passwordHash !== admin.passwordHash) return { modifiedCount: 0 };
    admin = { ...admin, passwordHash: update.$set.passwordHash, tokenVersion: (admin.tokenVersion ?? 0) + 1 };
    writes++;
    return { modifiedCount: 1 };
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});
beforeEach(() => {
  clock += 16 * 60 * 1000;
  writes = 0; failWrite = false; forceConflict = false;
  admin = { _id: id, name: 'Test Admin', email: 'admin@example.test', role: 'admin', isActive: true, passwordHash: initialHash, tokenVersion: 0 };
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  mock.restoreAll();
  Object.assign(env, savedEnv);
});
function token(claims = {}) { return jwt.sign({ sub: id, ...claims }, secret, { expiresIn: '1h' }); }
async function request(path, { method = 'GET', body, authorization = token() } = {}) {
  const response = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(), retryAfter: response.headers.get('retry-after') };
}
const change = (body = { currentPassword, newPassword }, authorization = token()) => request('/me/password', { method: 'PATCH', body, authorization });

test('Successful change hashes with cost 12, invalidates every old token and permits only the new password login', async () => {
  const legacy = token();
  const versioned = token({ tokenVersion: 0 });
  assert.equal((await request('/me', { authorization: legacy })).status, 200);
  assert.equal((await change(undefined, versioned)).status, 200);
  assert.equal(writes, 1);
  assert.equal(admin.tokenVersion, 1);
  assert.equal(bcrypt.getRounds(admin.passwordHash), 12);
  assert.equal(await bcrypt.compare(newPassword, admin.passwordHash), true);
  for (const authorization of [legacy, versioned]) assert.equal((await request('/me', { authorization })).status, 401);
  assert.equal((await request('/login', { method: 'POST', body: { email: admin.email, password: currentPassword } })).status, 401);
  const login = await request('/login', { method: 'POST', body: { email: admin.email, password: newPassword } });
  assert.equal(login.status, 200);
  assert.equal(jwt.verify(login.body.token, secret).tokenVersion, 1);
  assert.equal((await request('/me', { authorization: login.body.token })).status, 200);
  assert.deepEqual(Object.keys(login.body.admin).sort(), ['email', 'id', 'name', 'role']);
});

test('Incorrect current password and password reuse do not write', async () => {
  assert.equal((await change({ currentPassword: 'incorrect-test-password', newPassword })).status, 400);
  assert.equal((await change({ currentPassword, newPassword: currentPassword })).status, 400);
  assert.equal(writes, 0);
});

test('Missing, structured and unexpected fields are rejected', async () => {
  for (const body of [{}, [], { currentPassword }, { currentPassword, newPassword: 123 }, { currentPassword, newPassword, _id: id }]) {
    assert.equal((await change(body)).status, 400);
  }
  assert.equal(writes, 0);
});

test('Email, role, password, isActive and tokenVersion cannot be changed through this endpoint', async () => {
  for (const key of ['email', 'role', 'password', 'isActive', 'tokenVersion']) {
    assert.equal((await change({ currentPassword, newPassword, [key]: 'untrusted' })).status, 400);
  }
  assert.equal(writes, 0);
});

test('Weak and oversized passwords including Unicode byte lengths are rejected', async () => {
  for (const value of ['short', 'a'.repeat(73), '界'.repeat(25), '😀'.repeat(11)]) {
    assert.equal((await change({ currentPassword, newPassword: value })).status, 400);
  }
  assert.equal(writes, 0);
});

test('Exactly 72 UTF-8 bytes are accepted without trimming or normalization', async () => {
  const value = ' ' + '界'.repeat(23) + '  ';
  assert.equal(Buffer.byteLength(value), 72);
  const result = await change({ currentPassword, newPassword: value });
  assert.deepEqual(result.body, { message: 'Password changed. Please sign in again.' });
  assert.equal(result.status, 200);
  assert.equal(await bcrypt.compare(value, admin.passwordHash), true);
  assert.equal(await bcrypt.compare(value.trim(), admin.passwordHash), false);
});

test('Missing, invalid, inactive and unauthorized sessions are rejected', async () => {
  assert.equal((await change(undefined, '')).status, 401);
  assert.equal((await change(undefined, 'invalid')).status, 401);
  admin.isActive = false;
  assert.equal((await change()).status, 401);
  admin.isActive = true; admin.role = 'editor';
  assert.equal((await change()).status, 403);
  assert.equal(writes, 0);
});

test('Five attempts exhaust the account limit and expiry permits another attempt', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await change({ currentPassword: 'incorrect', newPassword })).status, 400);
  const limited = await change();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.retryAfter) > 0);
  assert.equal(writes, 0);
  clock += 16 * 60 * 1000;
  assert.equal((await change()).status, 200);
});

test('Concurrent conflicting requests cannot overwrite each other', async () => {
  const results = await Promise.all([change(), change({ currentPassword, newPassword: 'another-test-password' })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(writes, 1);
  assert.equal(admin.tokenVersion, 1);
});

test('Database failure and compare-and-swap conflicts leave credentials unchanged', async () => {
  failWrite = true;
  const failed = await change();
  assert.equal(failed.status, 500);
  assert.equal(JSON.stringify(failed.body).includes('Private database detail'), false);
  failWrite = false; forceConflict = true;
  assert.equal((await change()).status, 409);
  assert.equal(admin.passwordHash, initialHash);
  assert.equal(admin.tokenVersion, 0);
  assert.equal(writes, 0);
});

test('Legacy records and tokens work at version zero but not after changing the password', async () => {
  delete admin.tokenVersion;
  const legacy = token();
  assert.equal((await request('/me', { authorization: legacy })).status, 200);
  assert.equal((await change(undefined, legacy)).status, 200);
  assert.equal(admin.tokenVersion, 1);
  assert.equal((await request('/me', { authorization: legacy })).status, 401);
});

test('Malformed and mismatched token versions fail closed', async () => {
  for (const tokenVersion of [null, '0', -1, 0.5, 1]) {
    assert.equal((await request('/me', { authorization: token({ tokenVersion }) })).status, 401);
  }
});

test('A versioned account can change again and invalidates its current token', async () => {
  admin.tokenVersion = 3;
  const authorization = token({ tokenVersion: 3 });
  assert.equal((await change({ currentPassword, newPassword: 'abcdefghijkl' }, authorization)).status, 200);
  assert.equal(admin.tokenVersion, 4);
  assert.equal((await change(undefined, authorization)).status, 401);
  assert.equal(writes, 1);
});

test('Empty current passwords, missing new passwords and query fields cannot trigger a write', async () => {
  for (const body of [{ currentPassword: '', newPassword }, { newPassword }, { currentPassword: null, newPassword }]) {
    assert.equal((await change(body)).status, 400);
  }
  assert.equal((await request('/me/password?adminId=other', { method: 'PATCH', body: { currentPassword, newPassword } })).status, 400);
  assert.equal(writes, 0);
});
