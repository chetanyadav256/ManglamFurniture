import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { imageStorage } from '../src/services/imageStorage.js';

// This test process uses only dummy credentials and mocked SDK transport.
process.env.CLOUDINARY_CLOUD_NAME = 'isolated-test';
process.env.CLOUDINARY_API_KEY = 'isolated-key';
process.env.CLOUDINARY_API_SECRET = 'isolated-secret';

test('Storage wrapper streams bytes with restricted upload options and HTTPS configuration', async (t) => {
  let received, options;
  t.mock.method(cloudinary.uploader, 'upload_stream', (settings, callback) => {
    options = settings;
    return new Writable({ write(chunk, encoding, done) { received = chunk; done(); }, final(done) { callback(null, { public_id: 'fixture' }); done(); } });
  });
  const buffer = Buffer.from('isolated fixture');
  assert.deepEqual(await imageStorage.upload(buffer, 'manglam-furniture/products/fixture'), { public_id: 'fixture' });
  assert.deepEqual(received, buffer);
  assert.equal(options.overwrite, false);
  assert.equal(options.resource_type, 'image');
  assert.equal(options.asset_folder, 'manglam-furniture/products');
  assert.equal(options.public_id, 'manglam-furniture/products/fixture');
  assert.deepEqual(options.allowed_formats, ['jpg', 'png', 'webp']);
  assert.equal(options.timeout, 60000);
  assert.equal(cloudinary.config().secure, true);
});

test('Storage wrapper sanitizes provider errors', async (t) => {
  t.mock.method(cloudinary.uploader, 'upload_stream', (settings, callback) => new Writable({
    write(chunk, encoding, done) { callback(new Error('provider private details')); done(); },
  }));
  await assert.rejects(imageStorage.upload(Buffer.from('fixture'), 'fixture'), { message: 'Image upload failed.' });
});

test('Cleanup uses image/upload invalidation and checks provider acknowledgement', async (t) => {
  let result = 'ok';
  t.mock.method(cloudinary.uploader, 'destroy', async (publicId, options) => {
    assert.equal(publicId, 'fixture');
    assert.deepEqual(options, { resource_type: 'image', type: 'upload', invalidate: true, timeout: 30000 });
    return { result };
  });
  await imageStorage.destroy('fixture');
  result = 'not found'; await imageStorage.destroy('fixture');
  result = 'error'; await assert.rejects(imageStorage.destroy('fixture'), { message: 'Image cleanup failed.' });
});
