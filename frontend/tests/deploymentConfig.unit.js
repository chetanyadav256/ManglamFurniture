import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { resolveApiBaseUrl } from '../src/services/api.js';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));

test('Vercel rewrites page paths to the SPA entry without redirects', async () => {
  const config = JSON.parse(await readFile(`${frontendRoot}vercel.json`, 'utf8'));
  assert.deepEqual(config, {
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  });
  assert.equal('redirects' in config, false);
});

test('Frontend deployment documents the Vercel build and public backend URL', async () => {
  const documentation = await readFile(`${frontendRoot}VERCEL_DEPLOYMENT.md`, 'utf8');
  const template = await readFile(`${frontendRoot}.env.example`, 'utf8');

  for (const requiredText of [
    'Root Directory:** `frontend`',
    'Framework Preset:** Vite',
    'Install Command:** `npm ci`',
    'Build Command:** `npm run build`',
    'Output Directory:** `dist`',
    '`VITE_API_BASE_URL`',
    'https://your-backend.onrender.com',
  ]) {
    assert.ok(
      documentation.includes(requiredText),
      `Missing deployment documentation: ${requiredText}`,
    );
  }
  assert.ok(template.includes('VITE_API_BASE_URL='));
  assert.ok(template.includes('https://your-backend.onrender.com'));
  assert.ok(!template.includes('JWT_SECRET='));
  assert.ok(!template.includes('MONGODB_URI='));
  assert.ok(!template.includes('CLOUDINARY_API_SECRET='));
});

test('API URL uses the Render URL in production and localhost only as a dev fallback', () => {
  assert.equal(
    resolveApiBaseUrl('https://furniture-api.onrender.com', false),
    'https://furniture-api.onrender.com/api',
  );
  assert.equal(
    resolveApiBaseUrl('https://furniture-api.onrender.com/api/', false),
    'https://furniture-api.onrender.com/api',
  );
  assert.equal(resolveApiBaseUrl(undefined, true), 'http://127.0.0.1:5000/api');
  assert.equal(resolveApiBaseUrl(undefined, false), '/api');
  assert.equal(resolveApiBaseUrl(undefined, false).includes('localhost'), false);
});
