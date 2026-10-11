import assert from 'node:assert/strict';
import { before, beforeEach, after, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Admin from '../src/models/Admin.js';
import Product from '../src/models/Product.js';
import { env } from '../src/config/env.js';
import { imageStorage } from '../src/services/imageStorage.js';
import { imageId } from '../src/controllers/adminImageController.js';
import { MAX_IMAGE_BYTES } from '../src/middleware/imageUpload.js';

const secret = 'isolated-image-test-secret-ABCDEFG0123456789!';
const productId = '507f1f77bcf86cd799439013';
const adminId = '507f1f77bcf86cd799439010';
const prefix = `manglam-furniture/products/${productId}_`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const legacy = (n) => ({ url: `/images/${n}.webp`, publicId: '' });
const managed = (n) => ({ url: `https://res.cloudinary.com/test/image/upload/${n}.png`, publicId: `${prefix}00000000-0000-4000-8000-${String(n).padStart(12, '0')}` });
let server, base, product, admin, uploads, destroyed, warnings, events;
let failUpload, failCleanup, failCommit, loseAcknowledgement, blockUpload;
const query = (value) => ({ select() { return this; }, lean: async () => structuredClone(value) });
const bearer = () => jwt.sign({ sub: adminId }, secret, { algorithm: 'HS256', expiresIn: '1h' });

before(async () => {
  assert.equal(mongoose.connection.readyState, 0);
  env.jwtSecret = secret;
  mock.method(Admin, 'findById', () => query(admin));
  mock.method(Product, 'findOne', (filter) => query(product && String(filter._id) === productId
    && (filter.isActive === undefined || product.isActive === filter.isActive) ? product : null));
  mock.method(Product, 'findOneAndUpdate', (filter, update, options) => ({ lean: async () => {
    assert.equal(options.runValidators, true);
    assert.equal(options.new, true);
    assert.equal(filter.isActive, true);
    if (failCommit) throw new Error('private database error');
    if (!product || !product.isActive || JSON.stringify(filter.images) !== JSON.stringify(product.images)) return null;
    product.images = structuredClone(update.$set.images);
    product.__v = (product.__v ?? 0) + update.$inc.__v;
    events.push('commit');
    if (loseAcknowledgement) throw new Error('private network error after commit');
    return structuredClone(product);
  } }));
  mock.method(imageStorage, 'upload', async (buffer, publicId) => {
    uploads.push(publicId);
    if (blockUpload) await blockUpload();
    if (failUpload === uploads.length) throw new Error('private Cloudinary error');
    return { secure_url: `https://res.cloudinary.com/test/image/upload/${publicId}.png`, public_id: publicId, resource_type: 'image', format: buffer[0] === 137 ? 'png' : buffer[0] === 255 ? 'jpg' : 'webp' };
  });
  mock.method(imageStorage, 'destroy', async (publicId) => {
    events.push('destroy');
    destroyed.push(publicId);
    if (failCleanup) throw new Error('private Cloudinary error');
  });
  mock.method(console, 'warn', (message) => warnings.push(JSON.parse(message)));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/admin/products`;
});
beforeEach(() => {
  product = { _id: productId, category: '507f1f77bcf86cd799439011', name: 'Fixture', description: 'Fixture only', price: 100, isActive: true, images: [] };
  admin = { _id: adminId, role: 'admin', isActive: true };
  uploads = []; destroyed = []; warnings = []; events = [];
  failUpload = 0; failCleanup = false; failCommit = false; loseAcknowledgement = false; blockUpload = null;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  mock.restoreAll();
  env.jwtSecret = '';
  assert.equal(mongoose.connection.readyState, 0);
});
async function request(path, { method = 'POST', body, token = bearer(), headers = {} } = {}) {
  const response = await fetch(base + path, { method, body, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
  return { status: response.status, body: await response.json() };
}
function form(count = 1, buffer = png, type = 'image/png', field = 'images') {
  const data = new FormData();
  for (let n = 0; n < count; n++) data.append(field, new Blob([buffer], { type }), `image-${n}.png`);
  return data;
}
const upload = (body = form(), options = {}) => request(`/${productId}/images`, { body, ...options });
const manage = (image, method = 'DELETE', suffix = '') => request(`/${productId}/images/${imageId(image)}${suffix}`, { method });

test('Single upload uses product-scoped server IDs, HTTPS, metadata and stable image IDs', async () => {
  const result = await upload();
  assert.equal(result.status, 201);
  assert.equal(result.body.product.images.length, 1);
  assert.match(uploads[0], new RegExp(`^${prefix}[a-f0-9-]{36}$`));
  assert.equal(result.body.product.images[0].imageId, imageId(product.images[0]));
  assert.match(product.images[0].url, /^https:/);
  assert.equal(destroyed.length, 0);
});
test('Five images can upload together; existing images and main image retain order', async () => {
  assert.equal((await upload(form(5))).status, 201);
  assert.equal(product.images.length, 5);
  product.images = [legacy(1), legacy(2)];
  const result = await upload(form(3));
  assert.equal(result.status, 201);
  assert.deepEqual(product.images.slice(0, 2), [legacy(1), legacy(2)]);
  assert.equal(product.images.length, 5);
});
test('Reject unsupported MIME, signature mismatch, invalid and truncated content before Cloudinary', async () => {
  for (const [buffer, type] of [[png, 'image/svg+xml'], [png, 'image/jpeg'], [Buffer.from('not an image'), 'image/png'], [png.subarray(0, 24), 'image/png']]) {
    assert.equal((await upload(form(1, buffer, type))).status, 415);
  }
  assert.equal(uploads.length, 0);
});
test('JPEG and WebP signatures are accepted (Cloudinary performs full decoding)', async () => {
  const jpegSignature = Buffer.from([255, 216, 255, 217]);
  const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  assert.equal((await upload(form(1, jpegSignature, 'image/jpeg'))).status, 201);
  assert.equal((await upload(form(1, webp, 'image/webp'))).status, 201);
});
test('5 MB boundary accepted by parser; larger file rejected', async () => {
  const sized = Buffer.alloc(MAX_IMAGE_BYTES);
  png.copy(sized); png.subarray(png.length - 12).copy(sized, sized.length - 12);
  assert.equal((await upload(form(1, sized))).status, 201);
  assert.equal((await upload(form(1, Buffer.alloc(MAX_IMAGE_BYTES + 1)))).status, 413);
});
test('Reject sixth file, wrong fields, text fields, empty files and nonmultipart requests', async () => {
  assert.equal((await upload(form(6))).status, 400);
  assert.equal((await upload(form(1, png, 'image/png', 'file'))).status, 400);
  const text = form(); text.append('publicId', 'untrusted');
  assert.equal((await upload(text)).status, 400);
  assert.equal((await upload(form(0))).status, 400);
  assert.equal((await upload(form(1, Buffer.alloc(0)))).status, 415);
  assert.equal((await upload('{}', { headers: { 'Content-Type': 'application/json' } })).status, 415);
  assert.equal(uploads.length, 0);
});
test('Existing count enforced before uploading; full and inactive products are rejected', async () => {
  product.images = [1, 2, 3, 4].map(legacy);
  assert.equal((await upload(form(2))).status, 409);
  product.images.push(legacy(5));
  assert.equal((await upload()).status, 409);
  product.isActive = false;
  assert.equal((await upload()).status, 404);
  assert.equal(uploads.length, 0);
});
test('All image routes require an active admin and valid JWT', async () => {
  for (const [method, tail] of [['POST', ''], ['GET', ''], ['DELETE', '/a'.padEnd(65, 'a')], ['PATCH', '/a'.padEnd(65, 'a') + '/main']]) {
    assert.equal((await request(`/${productId}/images${tail}`, { method, token: '' })).status, 401);
  }
  assert.equal((await upload(form(), { token: 'invalid' })).status, 401);
  admin.isActive = false;
  assert.equal((await upload()).status, 401);
  admin.isActive = true; admin.role = 'viewer';
  assert.equal((await upload()).status, 403);
  assert.equal(uploads.length, 0);
});
test('Invalid/missing product IDs and unsupported queries are rejected', async () => {
  assert.equal((await request('/invalid/images', { body: form() })).status, 400);
  assert.equal((await request('/507f1f77bcf86cd799439099/images', { body: form() })).status, 404);
  assert.equal((await request(`/${productId}/images?folder=other`, { body: form() })).status, 400);
  assert.equal(uploads.length, 0);
});
test('Partial Cloudinary failure cleans all attempted assets without changing MongoDB', async () => {
  product.images = [legacy(1)]; failUpload = 2;
  const result = await upload(form(3));
  assert.equal(result.status, 502);
  assert.deepEqual(destroyed, uploads);
  assert.deepEqual(product.images, [legacy(1)]);
  assert.equal(JSON.stringify(result.body).includes('private'), false);
});
test('Cleanup failures produce safe recovery records', async () => {
  failUpload = 2; failCleanup = true;
  assert.equal((await upload(form(2))).status, 502);
  assert.equal(warnings[0].reason, 'cloudinary_cleanup_failed');
  assert.deepEqual(warnings[0].publicIds, uploads);
});
test('Unexpected provider metadata cannot persist foreign IDs or insecure URLs', async (t) => {
  t.mock.method(imageStorage, 'upload', async (buffer, publicId) => {
    uploads.push(publicId);
    return { public_id: 'another-product/asset', secure_url: 'http://example.com/unsafe.png', format: 'png', resource_type: 'image' };
  });
  assert.equal((await upload()).status, 502);
  assert.deepEqual(product.images, []);
  assert.deepEqual(destroyed, uploads);
  assert.equal(destroyed.includes('another-product/asset'), false);
});
test('Image management rejects body fields instead of accepting a caller-supplied public ID', async () => {
  product.images = [managed(1)];
  const result = await request(`/${productId}/images/${imageId(product.images[0])}`, {
    method: 'DELETE', body: JSON.stringify({ publicId: 'another-product/asset' }), headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(result.status, 400);
  assert.equal(destroyed.length, 0);
  assert.equal(product.images.length, 1);
});
test('Uncertain database commits retain assets, including a lost successful acknowledgement', async () => {
  for (const committed of [false, true]) {
    failCommit = !committed; loseAcknowledgement = committed;
    assert.equal((await upload()).status, 502);
    assert.equal(destroyed.length, 0);
    assert.equal(warnings.at(-1).reason, 'database_commit_uncertain');
  }
  assert.equal(product.images.length, 1);
});
test('Removal commits before destruction and preserves remaining order', async () => {
  product.images = [managed(1), managed(2), managed(3)];
  const result = await manage(product.images[1]);
  assert.equal(result.status, 200);
  assert.deepEqual(events, ['commit', 'destroy']);
  assert.deepEqual(product.images, [managed(1), managed(3)]);
  assert.deepEqual(destroyed, [managed(2).publicId]);
});
test('Removal cleanup failure returns committed product and cleanupPending', async () => {
  product.images = [managed(1)]; failCleanup = true;
  const result = await manage(product.images[0]);
  assert.equal(result.status, 200);
  assert.equal(result.body.cleanupPending, true);
  assert.deepEqual(product.images, []);
  assert.equal(warnings[0].reason, 'cloudinary_cleanup_failed');
});
test('Failed removal commit never deletes Cloudinary assets', async () => {
  product.images = [managed(1)]; failCommit = true;
  assert.equal((await manage(product.images[0])).status, 502);
  assert.equal(destroyed.length, 0);
  assert.equal(product.images.length, 1);
  assert.equal(warnings[0].reason, 'database_removal_uncertain');
});
test('Main selection preserves remaining order and never destroys assets', async () => {
  product.images = [managed(1), managed(2), managed(3)];
  const result = await manage(product.images[2], 'PATCH', '/main');
  assert.equal(result.status, 200);
  assert.deepEqual(product.images, [managed(3), managed(1), managed(2)]);
  assert.equal(destroyed.length, 0);
  assert.equal((await manage(product.images[0], 'PATCH', '/main')).status, 200);
});
test('Image identifiers cannot select another product asset; legacy/external IDs are not destroyed', async () => {
  product.images = [managed(1), { url: 'https://example.com/external.png', publicId: 'another-product/image' }, legacy(1)];
  assert.equal((await manage(managed(99))).status, 404);
  assert.equal((await request(`/${productId}/images/not-an-image-id`, { method: 'DELETE' })).status, 400);
  assert.equal((await manage(product.images[1])).status, 200);
  assert.equal((await manage(legacy(1))).status, 200);
  assert.equal(destroyed.length, 0);
});
test('Duplicate legacy references retain the asset while one reference remains', async () => {
  product.images = [managed(1), managed(1)];
  assert.equal((await manage(managed(1))).status, 200);
  assert.equal(destroyed.length, 0);
});
test('Admin image GET returns stable IDs without changing public product output', async () => {
  product.images = [managed(1)];
  const result = await request(`/${productId}/images`, { method: 'GET' });
  assert.equal(result.status, 200);
  assert.equal(result.body.product.images[0].imageId, imageId(managed(1)));
});
test('Concurrent uploads cannot exceed five, and rejected assets are cleaned', async () => {
  product.images = [1, 2, 3, 4].map(legacy);
  let waiting = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  blockUpload = async () => { if (++waiting === 2) release(); await gate; };
  const results = await Promise.all([upload(), upload()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(product.images.length, 5);
  assert.equal(destroyed.length, 1);
  assert.notEqual(destroyed[0], product.images[4].publicId);
});
test('Admission control rejects a third in-flight upload before buffering', async () => {
  let release, started;
  const gate = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { started = resolve; });
  blockUpload = async () => { if (uploads.length === 2) started(); await gate; };
  const first = upload(); const second = upload();
  await ready;
  try { assert.equal((await upload()).status, 429); }
  finally { release(); await Promise.all([first, second]); }
});
test('Existing JSON endpoints cannot bypass count/ownership or replace image arrays', async () => {
  const result = await request(`/${productId}`, { method: 'PATCH', body: JSON.stringify({ images: [] }), headers: { 'Content-Type': 'application/json' } });
  assert.equal(result.status, 400);
  for (const images of [Array.from({ length: 6 }, (_, n) => legacy(n)), [managed(1)]]) {
    const created = await request('', { body: JSON.stringify({ name: 'Fixture', category: product.category, description: 'Fixture', price: 1, images }), headers: { 'Content-Type': 'application/json' } });
    assert.equal(created.status, 400);
  }
});
