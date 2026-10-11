// Explicit Node test file; excluded from Playwright's *.test.js discovery.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import axios from 'axios';
import {
  api,
  ApiError,
  resolveApiBaseUrl,
  getProducts,
  getProduct,
  getCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getHealth,
} from '../src/services/api.js';

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
});
const id = '507f1f77bcf86cd799439013';
function respond(data, inspect = () => {}) {
  api.defaults.adapter = async (config) => {
    inspect(config);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

test('Base URL uses development fallback, production same-origin and configured URLs', () => {
  assert.equal(resolveApiBaseUrl(undefined, true), 'http://127.0.0.1:5000/api');
  assert.equal(resolveApiBaseUrl('  ', true), 'http://127.0.0.1:5000/api');
  assert.equal(resolveApiBaseUrl(undefined, false), '/api');
  assert.equal(resolveApiBaseUrl('https://example.com/'), 'https://example.com/api');
  assert.equal(resolveApiBaseUrl('https://example.com/api/'), 'https://example.com/api');
  assert.equal(resolveApiBaseUrl('/api'), '/api');
});
test('Products preserve response envelope, empty results and pagination', async () => {
  const body = { products: [], pagination: { total: 0, page: 1, limit: 12, totalPages: 0 } };
  respond(body, (config) => {
    assert.equal(config.url, '/products');
    assert.equal(config.method, 'get');
  });
  assert.deepEqual(await getProducts(), body);
});
test('Combined supported filters use backend names, preserve zero and encode search text', async () => {
  const filters = {
    search: ' oak & cream ',
    category: 'sofas',
    minPrice: 0,
    maxPrice: 1000,
    sort: 'price_asc',
    page: 2,
    limit: 6,
  };
  respond({}, (config) => {
    assert.deepEqual(config.params, { ...filters, search: 'oak & cream' });
    const url = new URL(api.getUri(config), 'https://example.com');
    assert.equal(url.searchParams.get('search'), 'oak & cream');
    assert.equal(url.searchParams.get('minPrice'), '0');
  });
  await getProducts(filters);
  assert.equal(filters.search, ' oak & cream ');
});
test('Tag aliases search; empty optional values are omitted', async () => {
  respond({}, (config) => assert.deepEqual(config.params, { search: 'living room' }));
  await getProducts({
    tag: ' living room ',
    search: '',
    category: null,
    sort: undefined,
    page: ' ',
  });
});
test('Unsupported tag combinations, unknown and structured parameters reject without requesting', async () => {
  api.defaults.adapter = () => assert.fail('Must not send an unsupported request');
  await assert.rejects(getProducts({ search: 'sofa', tag: 'green' }), {
    code: 'UNSUPPORTED_FILTER',
  });
  for (const filters of [
    null,
    [],
    { unknown: 1 },
    { category: ['sofas'] },
    { page: Infinity },
    { search: { $ne: '' } },
  ]) {
    await assert.rejects(getProducts(filters), { code: 'INVALID_FILTER' });
  }
});
test('Product details and category responses retain backend fields', async () => {
  const product = {
    id,
    category: { id: 'category-id', slug: 'sofas' },
    images: [{ url: '/images/sofa.webp', publicId: '' }],
    dimensions: { width: 100 },
  };
  respond({ product }, (config) => assert.equal(config.url, `/products/${id}`));
  assert.deepEqual(await getProduct(id), { product });
  respond({ categories: [] }, (config) => assert.equal(config.url, '/categories'));
  assert.deepEqual(await getCategories(), { categories: [] });
  await assert.rejects(getProduct('../health'), { code: 'INVALID_PRODUCT_ID', status: 400 });
});
test('Admin category writes use protected routes, expected payloads, and preserve response envelopes', async () => {
  const category = { id, name: 'Home Office', slug: 'home-office' };
  respond({ category }, (config) => {
    assert.equal(config.method, 'post');
    assert.equal(config.url, '/admin/categories');
    assert.equal(config.headers.Authorization, `Bearer ${'in-memory-test-token'}`);
    assert.deepEqual(JSON.parse(config.data), { name: 'Home Office' });
  });
  assert.deepEqual(await createAdminCategory({ name: 'Home Office' }, 'in-memory-test-token'), {
    category,
  });

  respond({ category }, (config) => {
    assert.equal(config.method, 'patch');
    assert.equal(config.url, `/admin/categories/${id}`);
    assert.equal(config.headers.Authorization, `Bearer ${'in-memory-test-token'}`);
    assert.deepEqual(JSON.parse(config.data), { name: 'Home Office' });
  });
  assert.deepEqual(await updateAdminCategory(id, { name: 'Home Office' }, 'in-memory-test-token'), {
    category,
  });

  respond({ message: 'Category deleted.', categoryId: id }, (config) => {
    assert.equal(config.method, 'delete');
    assert.equal(config.url, `/admin/categories/${id}`);
    assert.equal(config.headers.Authorization, `Bearer ${'in-memory-test-token'}`);
  });
  assert.deepEqual(await deleteAdminCategory(id, 'in-memory-test-token'), {
    message: 'Category deleted.',
    categoryId: id,
  });
});
test('Admin category writes reject missing tokens and malformed IDs without requests', async () => {
  api.defaults.adapter = () => assert.fail('Must not send an invalid admin category request');
  assert.throws(() => createAdminCategory({ name: 'Home Office' }, ''), {
    code: 'AUTH_REQUIRED',
    status: 401,
  });
  await assert.rejects(updateAdminCategory('../health', { name: 'Test' }, 'token'), {
    code: 'INVALID_CATEGORY_ID',
    status: 400,
  });
  await assert.rejects(deleteAdminCategory('not-an-id', 'token'), {
    code: 'INVALID_CATEGORY_ID',
    status: 400,
  });
  await assert.rejects(deleteAdminCategory(id, ''), { code: 'AUTH_REQUIRED', status: 401 });
});
test('Existing health helper remains available', async () => {
  respond({ status: 'ok' }, (config) => assert.equal(config.url, '/health'));
  assert.deepEqual(await getHealth(), { status: 'ok' });
});
test('HTTP failures expose useful status and safe message without Axios internals', async () => {
  for (const status of [400, 404, 500]) {
    api.defaults.adapter = async (config) => {
      throw new axios.AxiosError(
        'raw error',
        'ERR_BAD_RESPONSE',
        config,
        {},
        { status, data: { message: 'Product not found.' } },
      );
    };
    await assert.rejects(getProducts(), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, 'HTTP_ERROR');
      assert.equal(error.config, undefined);
      if (status < 500) assert.equal(error.message, 'Product not found.');
      else assert.match(error.message, /server could not complete/);
      return true;
    });
  }
});
test('Network failures and timeouts have distinct actionable errors', async () => {
  for (const [code, expected] of [
    ['ERR_NETWORK', 'NETWORK_ERROR'],
    ['ECONNABORTED', 'TIMEOUT'],
    ['ETIMEDOUT', 'TIMEOUT'],
  ]) {
    api.defaults.adapter = async () => {
      throw new axios.AxiosError('raw error', code);
    };
    await assert.rejects(getCategories(), { name: 'ApiError', code: expected, status: null });
  }
});
test('All helpers support AbortSignal and preserve cancellation', async () => {
  const controller = new AbortController();
  respond({}, (config) => assert.equal(config.signal, controller.signal));
  await getProducts({}, { signal: controller.signal });
  await getProduct(id, { signal: controller.signal });
  await getCategories({ signal: controller.signal });
  await getHealth({ signal: controller.signal });
  controller.abort();
  await assert.rejects(getProducts({}, { signal: controller.signal }), (error) =>
    axios.isCancel(error),
  );
});
