import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Admin from '../src/models/Admin.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import { env } from '../src/config/env.js';

const secret = 'isolated-crud-tests-only-secret-77!abcXYZ';
const adminId = '507f1f77bcf86cd799439010';
const categoryId = '507f1f77bcf86cd799439011';
const categoryId2 = '507f1f77bcf86cd799439012';
const productId = '507f1f77bcf86cd799439013';
let admin, categories, products, createdProduct, createCalls, deletedCategoryIds, server, base;

function query(value) {
  return {
    select() { return this; },
    collation() { return this; },
    session() { return this; },
    lean: async () => value,
  };
}

function updateQuery(getValue) {
  return {
    select() { return this; },
    session() { return this; },
    lean: async () => getValue(),
  };
}

function token() {
  return jwt.sign({ sub: adminId }, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

function indexDefinitions() {
  return [
    { key: { _id: 1 } },
    { key: { name: 1 }, unique: true, collation: { locale: 'en', strength: 2 } },
    { key: { slug: 1 }, unique: true },
  ];
}

before(async () => {
  env.jwtSecret = secret;
  env.jwtExpiresIn = '1h';
  mock.method(mongoose, 'startSession', async () => {
    let active = false;
    return {
      startTransaction() { active = true; },
      async commitTransaction() { active = false; },
      async abortTransaction() { active = false; },
      inTransaction() { return active; },
      async endSession() {},
    };
  });
  mock.method(Admin, 'findById', () => query(admin));
  mock.method(Category.collection, 'indexes', async () => indexDefinitions());
  mock.method(Category, 'exists', async ({ _id }) => categories.some((category) => category._id === String(_id)));
  mock.method(Category, 'create', async (values) => {
    const created = { _id: categoryId, ...values };
    categories.push(created);
    return created;
  });
  mock.method(Category, 'findById', (id) => query(categories.find((category) => category._id === String(id)) ?? null));
  mock.method(Category, 'findOne', (filter) => {
    const match = categories.find((category) => {
      if (filter._id?.$ne && category._id === filter._id.$ne) return false;
      if (filter.name !== undefined) return category.name.toLowerCase() === filter.name.toLowerCase();
      return category.slug === filter.slug;
    });
    return query(match ?? null);
  });
  mock.method(Category, 'findByIdAndUpdate', (id, update) => updateQuery(() => {
    const existing = categories.find((category) => category._id === String(id));
    if (!existing) return null;
    Object.assign(existing, update.$set);
    return { ...existing };
  }));
  mock.method(Category, 'deleteOne', async ({ _id }) => {
    deletedCategoryIds.push(String(_id));
    categories = categories.filter((category) => category._id !== String(_id));
    return { deletedCount: 1 };
  });
  mock.method(Category, 'updateOne', async ({ _id }, update) => {
    const category = categories.find((entry) => entry._id === String(_id));
    if (!category) return { matchedCount: 0 };
    category.referenceVersion = (category.referenceVersion ?? 0) + update.$inc.referenceVersion;
    return { matchedCount: 1 };
  });

  mock.method(Product, 'create', async (input) => {
    const values = Array.isArray(input) ? input[0] : input;
    createCalls += 1;
    createdProduct = {
      _id: productId,
      name: values.name,
      category: values.category,
      price: values.price,
      description: values.description,
      material: values.material ?? '',
      color: values.color ?? '',
      dimensions: values.dimensions ?? {},
      tags: values.tags ?? [],
      images: values.images ?? [],
      isActive: values.isActive ?? true,
      createdAt: '2026-10-11T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
    };
    products.push(createdProduct);
    return Array.isArray(input) ? [createdProduct] : createdProduct;
  });
  mock.method(Product, 'findByIdAndUpdate', (id, update) => updateQuery(() => {
    const existing = products.find((product) => product._id === String(id));
    if (!existing) return null;
    Object.assign(existing, update.$set);
    return { ...existing };
  }));
  mock.method(Product, 'exists', ({ category }) => ({
    session() { return this; },
    then(resolve, reject) {
      return Promise.resolve(products.some((product) => product.category === String(category))).then(resolve, reject);
    },
  }));
  mock.method(Product, 'find', (filter) => {
    const found = products.filter((product) => !Object.hasOwn(filter, 'isActive') || product.isActive === filter.isActive);
    const chain = {
      select() { return this; },
      populate() { return this; },
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      maxTimeMS() { return this; },
      lean: async () => found.map((product) => ({ ...product })),
    };
    return chain;
  });
  mock.method(Product, 'countDocuments', (filter) => ({
    maxTimeMS() { return this; },
    then(resolve, reject) {
      return Promise.resolve(products.filter((product) => !Object.hasOwn(filter, 'isActive') || product.isActive === filter.isActive).length).then(resolve, reject);
    },
  }));

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(() => {
  admin = { _id: adminId, name: 'Admin', email: 'admin@example.com', role: 'admin', isActive: true };
  categories = [
    { _id: categoryId, name: 'Living Room', slug: 'living-room', description: 'Sitting room' },
    { _id: categoryId2, name: 'Bedroom', slug: 'bedroom' },
  ];
  products = [{
    _id: productId, name: 'Test Sofa', category: categoryId, price: 250,
    description: 'A sofa', isActive: true, tags: [], images: [],
  }];
  createdProduct = null;
  createCalls = 0;
  deletedCategoryIds = [];
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  mock.restoreAll();
  env.jwtSecret = '';
  env.jwtExpiresIn = '1d';
});

async function request(path, { method = 'GET', body, bearer = token() } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

const newProduct = {
  name: '  Oak Dining Table ',
  category: categoryId,
  price: 450,
  description: ' A sturdy dining table ',
};

test('Creates a valid product and normalizes/deduplicates tags and image metadata', async () => {
  const result = await request('/admin/products', {
    method: 'POST',
    body: {
      ...newProduct,
      tags: [' Dining ', 'dining', ' OAK '],
      images: [{ url: '/images/table.webp' }],
      dimensions: { length: 120, width: 60 },
    },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.product.name, 'Oak Dining Table');
  assert.deepEqual(result.body.product.tags, ['dining', 'oak']);
  assert.deepEqual(result.body.product.images, [{ url: '/images/table.webp', publicId: '' }]);
  assert.equal(result.body.product.category, categoryId);
});

test('Rejects missing fields, invalid prices, malformed body, and invalid/missing categories', async () => {
  for (const body of [
    { ...newProduct, description: undefined },
    { ...newProduct, price: -1 },
    { ...newProduct, price: '450' },
    { ...newProduct, price: Infinity },
    { ...newProduct, category: 'invalid' },
    { ...newProduct, category: '507f1f77bcf86cd799439099' },
    { ...newProduct, role: 'superadmin' },
    { ...newProduct, images: [{ url: 'javascript:alert(1)' }] },
  ]) {
    assert.equal((await request('/admin/products', { method: 'POST', body })).status, 400);
  }
  assert.equal(createCalls, 0);
});

test('PATCH changes only provided product fields and validates IDs and fields', async () => {
  const updated = await request(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: { price: 300 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.product.price, 300);
  assert.equal(updated.body.product.name, 'Test Sofa');
  assert.equal((await request('/admin/products/not-an-id', { method: 'PATCH', body: { price: 300 } })).status, 400);
  assert.equal((await request(`/admin/products/${productId}`, { method: 'PATCH', body: { role: 'admin' } })).status, 400);
  assert.equal((await request(`/admin/products/${productId}`, { method: 'PATCH', body: {} })).status, 400);
});

test('Soft deletion is idempotent and inactive products disappear from public lists', async () => {
  const first = await request(`/admin/products/${productId}`, { method: 'DELETE' });
  const second = await request(`/admin/products/${productId}`, { method: 'DELETE' });
  assert.equal(first.status, 200);
  assert.deepEqual(second.body, first.body);
  assert.equal(products[0].isActive, false);
  assert.deepEqual((await request('/products')).body.products, []);
});

test('Product writes require an authenticated active admin role', async () => {
  const payload = newProduct;
  for (const [path, method, body] of [
    ['/admin/products', 'POST', payload],
    [`/admin/products/${productId}`, 'PATCH', { price: 1 }],
    [`/admin/products/${productId}`, 'DELETE', undefined],
    ['/admin/categories', 'POST', { name: 'Office' }],
    [`/admin/categories/${categoryId}`, 'PATCH', { name: 'Office' }],
    [`/admin/categories/${categoryId}`, 'DELETE', undefined],
  ]) {
    assert.equal((await request(path, { method, body, bearer: '' })).status, 401);
  }
  admin.role = 'editor';
  assert.equal((await request('/admin/products', { method: 'POST', body: payload })).status, 403);
  assert.equal((await request('/admin/categories', { method: 'POST', body: { name: 'Office' } })).status, 403);
  assert.equal(createCalls, 0);
  assert.deepEqual(deletedCategoryIds, []);
});

test('Creates categories with normalized slugs and rejects duplicate names case-insensitively', async () => {
  const created = await request('/admin/categories', { method: 'POST', body: { name: '  Café Tables  ', description: 'Small tables' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.category.name, 'Café Tables');
  assert.equal(created.body.category.slug, 'cafe-tables');

  const duplicate = await request('/admin/categories', { method: 'POST', body: { name: 'living ROOM' } });
  assert.equal(duplicate.status, 409);
  const duplicateSlug = await request('/admin/categories', { method: 'POST', body: { name: 'Living-Room' } });
  assert.equal(duplicateSlug.status, 409);
});

test('Category rename preserves its ID and rejects slug collisions', async () => {
  const renamed = await request(`/admin/categories/${categoryId}`, {
    method: 'PATCH',
    body: { name: 'Dining Room' },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.category.id, categoryId);
  assert.equal(renamed.body.category.slug, 'dining-room');
  assert.equal((await request(`/admin/categories/${categoryId}`, {
    method: 'PATCH',
    body: { name: 'Bedroom' },
  })).status, 409);
});

test('Category deletion succeeds only when no products reference it', async () => {
  const unused = await request(`/admin/categories/${categoryId2}`, { method: 'DELETE' });
  assert.equal(unused.status, 200);
  assert.deepEqual(deletedCategoryIds, [categoryId2]);

  products[0].isActive = false;
  const referenced = await request(`/admin/categories/${categoryId}`, { method: 'DELETE' });
  assert.equal(referenced.status, 409);
  assert.equal(deletedCategoryIds.includes(categoryId), false);
});

test('Category writes fail closed when the required unique indexes are missing', async () => {
  const indexesStub = mock.method(Category.collection, 'indexes', async () => [{ key: { _id: 1 } }]);
  const result = await request('/admin/categories', { method: 'POST', body: { name: 'Office' } });
  assert.equal(result.status, 503);
  assert.equal(categories.some((category) => category.name === 'Office'), false);
  indexesStub.mock.restore();
});
