import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/Product.js';
import Category from '../src/models/Category.js';

// Stub the collection boundary: real routing, validation, Mongoose casting and
// population run, but no MongoDB connection or database writes are possible.
const id = (n) => n.toString(16).padStart(24, '0');
const categoriesFixture = [
  { _id: id(101), name: 'Sofas', slug: 'sofas', description: 'Comfort' },
  { _id: id(102), name: 'beds', slug: 'beds' },
];
const productsFixture = [
  { _id: id(1), name: 'Olive Sofa', category: id(101), price: 300, description: 'Soft seating', tags: ['living room'], createdAt: '2026-01-01' },
  { _id: id(2), name: 'Oak Bed', category: id(102), price: 200, description: 'Solid timber', tags: ['bedroom'], createdAt: '2026-01-03' },
  { _id: id(3), name: 'Lounge', category: id(101), price: 100, description: 'A sofa for reading', tags: ['green', 'living room'], createdAt: '2026-01-02' },
  { _id: id(4), name: 'Hidden Sofa', category: id(101), price: 50, description: 'Hidden', tags: ['green'], createdAt: '2026-01-04', isActive: false },
  { _id: id(5), name: 'Literal .* Chair', category: id(101), price: 0, description: 'Special', tags: [], createdAt: '2026-01-02' },
].map((p) => ({ isActive: true, images: [{ url: '/images/sofa.webp', publicId: '' }], __v: 7, ...p }));
let products, categories, calls, databaseError, server, base;

function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some((clause) => matches(row, clause));
    if (value?.$regex !== undefined) {
      const regex = new RegExp(value.$regex, value.$options);
      return (Array.isArray(row[key]) ? row[key] : [row[key]]).some((entry) => regex.test(entry ?? ''));
    }
    if (value?.$in) return value.$in.some((entry) => String(entry) === String(row[key]));
    if (value?.$gte !== undefined || value?.$lte !== undefined) {
      return (value.$gte === undefined || row[key] >= value.$gte) && (value.$lte === undefined || row[key] <= value.$lte);
    }
    return String(row[key]) === String(value);
  });
}

function query(rows, filter, options = {}) {
  if (databaseError) throw new Error('PRIVATE DATABASE ERROR AND STACK');
  calls.push({ filter, options });
  let result = rows.filter((row) => matches(row, filter));
  if (options.sort) result.sort((a, b) => {
    for (const [field, direction] of Object.entries(options.sort)) {
      const left = options.collation && typeof a[field] === 'string' ? a[field].toLowerCase() : a[field];
      const right = options.collation && typeof b[field] === 'string' ? b[field].toLowerCase() : b[field];
      if (left !== right) return (left < right ? -1 : 1) * direction;
    }
    return 0;
  });
  result = result.slice(options.skip ?? 0);
  if (options.limit) result = result.slice(0, options.limit);
  return structuredClone(result);
}

before(async () => {
  assert.equal(mongoose.connection.readyState, 0);
  for (const [model, rows] of [[Product, () => products], [Category, () => categories]]) {
    mock.method(model.collection, 'find', (filter, options) => ({ toArray: async () => query(rows(), filter, options) }));
    mock.method(model.collection, 'findOne', async (filter, options) => query(rows(), filter, options)[0] ?? null);
    mock.method(model.collection, 'countDocuments', async (filter, options) => query(rows(), filter, options).length);
    for (const method of ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany']) {
      mock.method(model.collection, method, () => { assert.fail('Unexpected database write'); });
    }
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(() => {
  products = structuredClone(productsFixture);
  categories = structuredClone(categoriesFixture);
  calls = [];
  databaseError = false;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  mock.restoreAll();
  assert.equal(mongoose.connection.readyState, 0);
});
async function request(path, status = 200, method = 'GET') {
  const response = await fetch(`${base}${path}`, { method });
  assert.equal(response.status, status, `${method} ${path}`);
  return response.json();
}
const ids = (body) => body.products.map((p) => p.id);

test('Active list, default newest order, populated category and public fields', async () => {
  const body = await request('/products');
  assert.deepEqual(ids(body), [id(2), id(5), id(3), id(1)]);
  assert.deepEqual(body.pagination, { total: 4, page: 1, limit: 12, totalPages: 1 });
  assert.equal(body.products[0].category.slug, 'beds');
  assert.equal(body.products[0].images[0].url, '/images/sofa.webp');
  for (const key of ['_id', '__v', 'isActive']) assert.equal(key in body.products[0], false);
  assert.ok(calls.some(({ options }) => options.maxTimeMS === 5000));
});
test('Case-insensitive name, description and tag search', async () => {
  assert.deepEqual(ids(await request('/products?search=OLIVE')), [id(1)]);
  assert.deepEqual(ids(await request('/products?search=TIMBER')), [id(2)]);
  assert.deepEqual(ids(await request('/products?search=GREEN')), [id(3)]);
  assert.deepEqual(ids(await request('/products?search=living%20%20room')), [id(3), id(1)]);
});
test('Search metacharacters are literal, including pathological patterns', async () => {
  assert.deepEqual(ids(await request('/products?search=.*')), [id(5)]);
  assert.deepEqual(ids(await request(`/products?search=${encodeURIComponent('(a+)+$')}`)), []);
});
test('Category slug filtering and unknown category', async () => {
  assert.deepEqual(ids(await request('/products?category=BEDS')), [id(2)]);
  assert.deepEqual((await request('/products?category=unknown')).pagination, { total: 0, page: 1, limit: 12, totalPages: 0 });
});
test('Inclusive price bounds and zero price', async () => {
  assert.deepEqual(ids(await request('/products?minPrice=100&maxPrice=200')), [id(2), id(3)]);
  assert.deepEqual(ids(await request('/products?maxPrice=0')), [id(5)]);
  assert.deepEqual(ids(await request('/products?minPrice=300')), [id(1)]);
});
test('All sorts and deterministic ties', async () => {
  for (const [sort, expected] of Object.entries({ price_asc: [5, 3, 2, 1], price_desc: [1, 2, 3, 5], newest: [2, 5, 3, 1], oldest: [1, 3, 5, 2] })) {
    assert.deepEqual(ids(await request(`/products?sort=${sort}`)), expected.map(id));
  }
});
test('Combined filters, sorting, pagination and out-of-range pages', async () => {
  const body = await request('/products?search=living&category=sofas&minPrice=100&maxPrice=300&sort=price_asc&page=2&limit=1');
  assert.deepEqual(ids(body), [id(1)]);
  assert.deepEqual(body.pagination, { total: 2, page: 2, limit: 1, totalPages: 2 });
  const beyond = await request('/products?page=10&limit=2');
  assert.deepEqual(beyond.products, []);
  assert.equal(beyond.pagination.total, 4);
});
test('Invalid, repeated, nested and unknown query parameters fail before querying', async () => {
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=1e2', 'page=9007199254740991&limit=100', 'limit=101', 'limit=0', 'limit=', 'minPrice=-1', 'maxPrice=Infinity', 'minPrice=NaN', 'minPrice=', 'minPrice=0x10', 'minPrice=1e3', 'minPrice=2&maxPrice=1', 'sort=invalid', 'sort=toString', 'search=', 'search=%20', `search=${'a'.repeat(101)}`, 'category=', 'category=bad/slug', 'page=1&page=2', 'search[$ne]=x', 'unknown=x']) {
    await request(`/products?${query}`, 400);
  }
  assert.equal(calls.length, 0);
});
test('Product detail, malformed IDs, missing and inactive products', async () => {
  const body = await request(`/products/${id(1)}`);
  assert.equal(body.product.id, id(1));
  assert.equal(body.product.category.name, 'Sofas');
  for (const value of ['invalid', 'abcdefghijkl', 'g'.repeat(24)]) await request(`/products/${value}`, 400);
  await request(`/products/${id(999)}`, 404);
  await request(`/products/${id(4)}`, 404);
  await request(`/products/${id(1)}?unexpected=1`, 400);
});
test('Categories are alphabetical with only public fields', async () => {
  const body = await request('/categories');
  assert.deepEqual(body.categories, [{ id: id(102), name: 'beds', slug: 'beds' }, { id: id(101), name: 'Sofas', slug: 'sofas', description: 'Comfort' }]);
  await request('/categories?unexpected=1', 400);
});
test('Empty database succeeds and orphaned categories serialize as null', async () => {
  categories = [];
  assert.equal((await request(`/products/${id(1)}`)).product.category, null);
  products = [];
  assert.deepEqual(await request('/products'), { products: [], pagination: { total: 0, page: 1, limit: 12, totalPages: 0 } });
  assert.deepEqual(await request('/categories'), { categories: [] });
});
test('Database errors do not expose internal details', async () => {
  databaseError = true;
  for (const path of ['/products', `/products/${id(1)}`, '/categories', '/products?category=sofas']) {
    assert.deepEqual(await request(path, 500), { message: 'Internal server error.' });
  }
});
test('No public write endpoints', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const path of ['/products', `/products/${id(1)}`, '/categories', `/categories/${id(101)}`]) await request(path, 404, method);
  }
  assert.equal(calls.length, 0);
});
