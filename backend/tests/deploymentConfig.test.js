import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import app from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { loginRateLimit } from '../src/middleware/loginRateLimit.js';

const servers = [];

async function listen(application) {
  const server = application.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

test('development defaults preserve local host, port and frontend origins', () => {
  const config = parseEnv({ NODE_ENV: 'development' });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 5000);
  assert.deepEqual(config.clientOrigins, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  assert.equal(config.trustProxy, false);
});

test('production uses the supplied port, public bind address and one trusted proxy hop', () => {
  const config = parseEnv({
    NODE_ENV: 'production',
    PORT: '10000',
    CLIENT_ORIGIN: 'https://manglam.example',
  });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 10000);
  assert.deepEqual(config.clientOrigins, ['https://manglam.example']);
  assert.equal(config.trustProxy, 1);

  const explicitHost = parseEnv({
    NODE_ENV: 'production',
    HOST: '0.0.0.0',
    PORT: '10000',
    CLIENT_ORIGIN: 'https://manglam.example',
  });
  assert.equal(explicitHost.host, '0.0.0.0');
});

test('invalid production CORS configuration and invalid ports fail clearly', () => {
  assert.throws(
    () => parseEnv({ NODE_ENV: 'production', PORT: '10000' }),
    /CLIENT_ORIGIN must list the deployed frontend origin/,
  );
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: 'production',
        CLIENT_ORIGIN: 'https://manglam.example/path',
      }),
    /CLIENT_ORIGIN must contain only comma-separated HTTP\(S\) origins/,
  );
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: 'production',
        PORT: '70000',
        CLIENT_ORIGIN: 'https://manglam.example',
      }),
    /PORT must be an integer between 1 and 65535/,
  );
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        CLIENT_ORIGIN: 'https://manglam.example',
      }),
    /HOST must be 0\.0\.0\.0 in production/,
  );
});

test('CORS allows configured origins and does not reflect arbitrary origins', async () => {
  const base = await listen(app);
  const allowed = await fetch(`${base}/api/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const denied = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://unlisted.example' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('one trusted proxy hop is used for req.ip and login rate limiting', async () => {
  const proxyApp = express();
  proxyApp.set(
    'trust proxy',
    parseEnv({
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'https://manglam.example',
    }).trustProxy,
  );
  proxyApp.post('/login', loginRateLimit, (req, res) => res.json({ ip: req.ip }));
  const base = await listen(proxyApp);
  const trustedClient = '198.51.100.72';

  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(`${base}/login`, {
      method: 'POST',
      headers: {
        'X-Forwarded-For': `203.0.113.${attempt + 1}, ${trustedClient}`,
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ip: trustedClient });
  }

  const limited = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'X-Forwarded-For': `192.0.2.10, ${trustedClient}` },
  });
  assert.equal(limited.status, 429);
});
