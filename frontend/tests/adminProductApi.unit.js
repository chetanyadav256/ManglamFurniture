import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import axios from 'axios';
import { api, ApiError } from '../src/services/api.js';
import {
  createAdminProduct,
  updateAdminProduct,
  deactivateAdminProduct,
  getAdminProductImages,
  uploadAdminProductImages,
  deleteAdminProductImage,
  setAdminProductMainImage,
  validateAdminProductImages,
} from '../src/admin/services/adminProductApi.js';

const originalAdapter = api.defaults.adapter;
const productId = '507f1f77bcf86cd799439013';
const imageId = 'a'.repeat(64);
const token = 'in-memory-test-token';

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

function response(data, inspect = () => {}) {
  api.defaults.adapter = async (config) => {
    inspect(config);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

function testImage({ type = 'image/jpeg', size = 1024, name = 'chair.jpg' } = {}) {
  const file = new Blob([new Uint8Array(size)], { type });
  Object.defineProperty(file, 'name', { value: name });
  return file;
}

function assertAuthorized(config, method, path) {
  assert.equal(config.method, method);
  assert.equal(config.url, path);
  assert.equal(config.headers.Authorization, `Bearer ${token}`);
}

test('Create, update, and deactivate use protected product endpoints and preserve envelopes', async () => {
  const newProduct = {
    name: 'Dining chair',
    category: '507f1f77bcf86cd799439014',
    price: 120,
    description: 'Solid wood chair',
  };
  const created = { product: { id: productId, ...newProduct } };
  response(created, (config) => {
    assertAuthorized(config, 'post', '/admin/products');
    assert.deepEqual(JSON.parse(config.data), newProduct);
  });
  assert.deepEqual(await createAdminProduct(newProduct, token), created);

  const updated = { product: { id: productId, ...newProduct, price: 125 } };
  response(updated, (config) => {
    assertAuthorized(config, 'patch', `/admin/products/${productId}`);
    assert.deepEqual(JSON.parse(config.data), { price: 125 });
  });
  assert.deepEqual(await updateAdminProduct(productId, { price: 125 }, token), updated);

  const deactivated = { message: 'Product deactivated.', productId };
  response(deactivated, (config) =>
    assertAuthorized(config, 'delete', `/admin/products/${productId}`),
  );
  assert.deepEqual(await deactivateAdminProduct(productId, token), deactivated);
});

test('Image listing uses the product images route and preserves imageId metadata', async () => {
  const images = {
    product: {
      id: productId,
      images: [
        { url: 'https://images.example.test/chair.webp', publicId: 'furniture/chair', imageId },
      ],
    },
  };
  response(images, (config) =>
    assertAuthorized(config, 'get', `/admin/products/${productId}/images`),
  );
  const result = await getAdminProductImages(productId, token);
  assert.deepEqual(result, images);
  assert.notEqual(result.product.images[0].imageId, result.product.images[0].publicId);
});

test('Image upload uses multipart field images, leaves boundary generation to browser, and checks total count', async () => {
  const files = [testImage(), testImage({ type: 'image/webp', name: 'chair.webp' })];
  let uploadRequest;
  api.defaults.adapter = async (config) => {
    assertAuthorized(config, 'get', `/admin/products/${productId}/images`);
    return {
      data: { product: { images: [{ imageId, url: '/one', publicId: 'cloudinary-id' }] } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const originalRequest = api.request.bind(api);
  api.request = async (config) => {
    if (config.method === 'get') return originalRequest(config);
    uploadRequest = config;
    return {
      data: { product: { id: productId, images: [{ imageId }, { imageId: 'b'.repeat(64) }] } },
    };
  };
  try {
    const result = await uploadAdminProductImages(productId, files, token);
    assert.equal(result.product.id, productId);
    assert.equal(uploadRequest.url, `/admin/products/${productId}/images`);
    assert.equal(uploadRequest.method, 'post');
    assert.equal(uploadRequest.headers.Authorization, `Bearer ${token}`);
    assert.equal(uploadRequest.data instanceof FormData, true);
    assert.deepEqual([...uploadRequest.data.keys()], ['images', 'images']);
    assert.equal(uploadRequest.headers['Content-Type'], undefined);
  } finally {
    api.request = originalRequest;
  }
});

test('Image upload permits exactly five images when no images already exist', async () => {
  const files = Array.from({ length: 5 }, (_, index) => testImage({ name: `chair-${index}.jpg` }));
  let uploadCount = 0;
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') {
      return {
        data: { product: { images: [] } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    }
    uploadCount = [...config.data.keys()].filter((key) => key === 'images').length;
    return { data: { product: { images: files } } };
  };

  await uploadAdminProductImages(productId, files, token);
  assert.equal(uploadCount, 5);
});

test('Image upload reports progress without setting a multipart boundary manually', async () => {
  const file = testImage();
  const progress = [];
  const originalRequest = api.request.bind(api);
  api.defaults.adapter = async (config) => ({
    data: { product: { id: productId, images: [] } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
  api.request = async (config) => {
    if (config.method === 'get') return originalRequest(config);
    assert.equal(config.headers['Content-Type'], undefined);
    config.onUploadProgress({ loaded: 2, total: 4 });
    config.onUploadProgress({ loaded: 4, total: 4 });
    return { data: { product: { id: productId, images: [] } } };
  };
  try {
    await uploadAdminProductImages(productId, [file], token, (percent) => progress.push(percent));
    assert.deepEqual(progress, [50, 100]);
  } finally {
    api.request = originalRequest;
  }
});

test('Image upload rejects invalid images and exceeding five total before posting', async () => {
  api.defaults.adapter = async (config) => ({
    data: { product: { images: Array.from({ length: 4 }, () => ({ imageId })) } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });

  await assert.rejects(uploadAdminProductImages(productId, [testImage(), testImage()], token), {
    name: 'ApiError',
    code: 'IMAGE_LIMIT',
    status: 409,
  });
  for (const files of [
    [],
    Array.from({ length: 6 }, () => testImage()),
    [testImage({ type: 'image/gif' })],
    [testImage({ size: 5 * 1024 * 1024 + 1 })],
    [testImage({ size: 0 })],
  ]) {
    assert.throws(() => validateAdminProductImages(files), ApiError);
  }
  assert.equal(validateAdminProductImages(new Set([testImage()])).length, 1);
  let requestCount = 0;
  api.defaults.adapter = async (config) => {
    requestCount += 1;
    return {
      data: { product: { images: Array.from({ length: 5 }, () => ({ imageId })) } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  await assert.rejects(uploadAdminProductImages(productId, [testImage()], token), {
    code: 'IMAGE_LIMIT',
  });
  assert.equal(requestCount, 1);
});

test('Image deletion and main selection use backend imageId in their path', async () => {
  response({ product: { id: productId, images: [] } }, (config) => {
    assertAuthorized(config, 'delete', `/admin/products/${productId}/images/${imageId}`);
  });
  await deleteAdminProductImage(productId, imageId, token);

  response({ product: { id: productId, images: [{ imageId }] } }, (config) => {
    assertAuthorized(config, 'patch', `/admin/products/${productId}/images/${imageId}/main`);
    assert.deepEqual(JSON.parse(config.data), {});
  });
  await setAdminProductMainImage(productId, imageId, token);
  await assert.rejects(deleteAdminProductImage(productId, 'public-id', token), {
    code: 'INVALID_IMAGE_ID',
    status: 400,
  });
  await assert.rejects(setAdminProductMainImage(productId, imageId.replaceAll('a', 'A'), token), {
    code: 'INVALID_IMAGE_ID',
    status: 400,
  });
});

test('Missing tokens and malformed product IDs fail before making requests', async () => {
  let requestCount = 0;
  api.defaults.adapter = async (config) => {
    requestCount += 1;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await assert.rejects(createAdminProduct({}, ''), { code: 'AUTH_REQUIRED', status: 401 });
  await assert.rejects(getAdminProductImages('bad-id', token), {
    code: 'INVALID_PRODUCT_ID',
    status: 400,
  });
  await assert.rejects(updateAdminProduct(productId, {}, undefined), {
    code: 'AUTH_REQUIRED',
    status: 401,
  });
  await assert.rejects(deactivateAdminProduct(productId, ''), {
    code: 'AUTH_REQUIRED',
    status: 401,
  });
  assert.equal(requestCount, 0);
});

test('401, 403, Cloudinary failures, and network errors become safe actionable ApiErrors', async () => {
  for (const status of [401, 403, 502]) {
    api.defaults.adapter = async (config) => {
      throw new axios.AxiosError(
        'private upstream details',
        'ERR_BAD_RESPONSE',
        config,
        {},
        {
          status,
          data: {
            message:
              status === 502
                ? 'Image operation failed. Please retry or contact the administrator.'
                : 'Admin access denied.',
          },
        },
      );
    };
    await assert.rejects(getAdminProductImages(productId, token), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.config, undefined);
      assert.doesNotMatch(error.message, /private upstream details/);
      return true;
    });
  }
  api.defaults.adapter = async () => {
    throw new axios.AxiosError('private network details', 'ERR_NETWORK');
  };
  await assert.rejects(getAdminProductImages(productId, token), {
    name: 'ApiError',
    code: 'NETWORK_ERROR',
    status: null,
  });
});
