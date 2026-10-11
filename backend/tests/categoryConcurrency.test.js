import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Admin from '../src/models/Admin.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import { env } from '../src/config/env.js';

const adminId = '507f1f77bcf86cd799439010';
const categoryId = '507f1f77bcf86cd799439011';
const otherCategoryId = '507f1f77bcf86cd799439012';
const productId = '507f1f77bcf86cd799439013';
const secret = 'isolated-category-concurrency-test-secret-33!abc';
let state, server, base, transientCommitFailures, transactionsStarted;

function matchesId(value, id) {
  return String(value) === String(id);
}

function transientConflict() {
  const error = new Error('Simulated transaction write conflict.');
  error.hasErrorLabel = (label) => label === 'TransientTransactionError';
  return error;
}

function newSession() {
  let snapshot;
  let baselineVersions;
  let touchedCategoryIds;
  let active = false;

  function touchCategory(id) {
    touchedCategoryIds.add(String(id));
  }

  return {
    startTransaction() {
      transactionsStarted++;
      snapshot = structuredClone(state);
      baselineVersions = new Map(snapshot.categories.map((category) => [
        String(category._id),
        category.referenceVersion ?? 0,
      ]));
      touchedCategoryIds = new Set();
      active = true;
    },
    async commitTransaction() {
      if (transientCommitFailures > 0) {
        transientCommitFailures--;
        throw transientConflict();
      }
      for (const id of touchedCategoryIds) {
        const beforeVersion = baselineVersions.get(id);
        const current = state.categories.find((category) => matchesId(category._id, id));
        if (beforeVersion !== undefined
          && (!current || (current.referenceVersion ?? 0) !== beforeVersion)) {
          throw transientConflict();
        }
      }
      state = snapshot;
      active = false;
    },
    async abortTransaction() {
      active = false;
    },
    inTransaction() {
      return active;
    },
    async endSession() {},
    get snapshot() {
      return snapshot;
    },
    touchCategory,
  };
}

function queryForAdmin(admin) {
  return {
    select() { return this; },
    lean: async () => admin,
  };
}

before(async () => {
  env.jwtSecret = secret;
  env.jwtExpiresIn = '1h';
  mock.method(mongoose, 'startSession', async () => newSession());
  mock.method(Admin, 'findById', () => queryForAdmin({
    _id: adminId,
    name: 'Fixture Admin',
    email: 'fixture@example.test',
    role: 'admin',
    isActive: true,
    tokenVersion: 0,
  }));
  mock.method(Category, 'updateOne', async ({ _id }, update, { session }) => {
    const category = session.snapshot.categories.find((item) => matchesId(item._id, _id));
    if (!category) return { matchedCount: 0 };
    category.referenceVersion = (category.referenceVersion ?? 0) + update.$inc.referenceVersion;
    session.touchCategory(category._id);
    return { matchedCount: 1 };
  });
  mock.method(Category, 'findById', (id) => {
    let session;
    return {
      select() { return this; },
      session(value) { session = value; return this; },
      lean: async () => session.snapshot.categories.find((item) => matchesId(item._id, id)) ?? null,
    };
  });
  mock.method(Category, 'deleteOne', async ({ _id }, { session }) => {
    const index = session.snapshot.categories.findIndex((item) => matchesId(item._id, _id));
    if (index === -1) return { deletedCount: 0 };
    session.touchCategory(_id);
    session.snapshot.categories.splice(index, 1);
    return { deletedCount: 1 };
  });
  mock.method(Product, 'exists', ({ category }) => {
    let session;
    return {
      session(value) { session = value; return this; },
      then(resolve, reject) {
        return Promise.resolve(
          session.snapshot.products.some((product) => matchesId(product.category, category)),
        ).then(resolve, reject);
      },
    };
  });
  mock.method(Product, 'create', async (documents, { session }) => {
    const created = documents.map((document, index) => ({
      _id: productId,
      name: document.name,
      category: document.category,
      price: document.price,
      description: document.description,
      material: document.material ?? '',
      color: document.color ?? '',
      dimensions: document.dimensions ?? {},
      tags: document.tags ?? [],
      images: document.images ?? [],
      isActive: document.isActive ?? true,
      createdAt: '2026-10-12T00:00:00.000Z',
      updatedAt: '2026-10-12T00:00:00.000Z',
      ...document,
      _id: index === 0 ? productId : `${productId}-${index}`,
    }));
    session.snapshot.products.push(...created);
    return created;
  });
  mock.method(Product, 'findByIdAndUpdate', (id, update, { session }) => ({
    lean: async () => {
      const product = session.snapshot.products.find((item) => matchesId(item._id, id));
      if (!product) return null;
      Object.assign(product, update.$set);
      return structuredClone(product);
    },
  }));

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(() => {
  state = {
    categories: [
      { _id: categoryId, name: 'Living Room', slug: 'living-room', referenceVersion: 0 },
      { _id: otherCategoryId, name: 'Bedroom', slug: 'bedroom', referenceVersion: 0 },
    ],
    products: [],
  };
  transientCommitFailures = 0;
  transactionsStarted = 0;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  mock.restoreAll();
  env.jwtSecret = '';
  env.jwtExpiresIn = '1d';
});

function token() {
  return jwt.sign({ sub: adminId, tokenVersion: 0 }, secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

const validProduct = (category = categoryId) => ({
  name: 'Oak table',
  category,
  price: 1200,
  description: 'Solid oak table',
});

test('Baseline check-then-delete interleaving reproduces the dangling-reference race', async () => {
  const categories = [{ _id: categoryId }];
  const products = [];
  let continueDeletion;
  let reportReferenceCheck;
  const deletionPaused = new Promise((resolve) => {
    reportReferenceCheck = resolve;
  });
  const allowDeletion = new Promise((resolve) => {
    continueDeletion = resolve;
  });

  const oldDelete = async () => {
    const referenced = products.some((product) => product.category === categoryId);
    reportReferenceCheck();
    await allowDeletion;
    if (!referenced) categories.splice(0, 1);
  };
  const oldCreate = async () => {
    assert.equal(categories.some((category) => category._id === categoryId), true);
    products.push({ category: categoryId });
  };

  const deleting = oldDelete();
  await deletionPaused;
  await oldCreate();
  continueDeletion();
  await deleting;
  assert.equal(categories.length, 0);
  assert.equal(products[0].category, categoryId);
});

test('Unused category can be deleted transactionally', async () => {
  const result = await request(`/admin/categories/${categoryId}`, { method: 'DELETE' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { message: 'Category deleted.', categoryId });
  assert.equal(state.categories.some((category) => matchesId(category._id, categoryId)), false);
});

test('Category deletion rejects active and inactive product references', async () => {
  for (const isActive of [true, false]) {
    state.products = [{ _id: productId, category: categoryId, isActive }];
    const result = await request(`/admin/categories/${categoryId}`, { method: 'DELETE' });
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, {
      message: 'Category cannot be deleted while products reference it.',
    });
    assert.equal(state.categories.some((category) => matchesId(category._id, categoryId)), true);
  }
});

test('Concurrent product creation and category deletion preserve the reference invariant', async () => {
  const [created, deleted] = await Promise.all([
    request('/admin/products', { method: 'POST', body: validProduct() }),
    request(`/admin/categories/${categoryId}`, { method: 'DELETE' }),
  ]);

  assert.ok(
    (created.status === 201 && deleted.status === 409)
      || (created.status === 400 && deleted.status === 200),
  );
  assert.equal(
    state.products.every((product) =>
      state.categories.some((category) => matchesId(category._id, product.category)),
    ),
    true,
  );
  if (created.status === 201) {
    assert.equal(deleted.status, 409);
    assert.equal(state.products[0].category, categoryId);
  } else {
    assert.equal(deleted.status, 200);
    assert.equal(created.status, 400);
  }
});

test('Concurrent product reassignment and category deletion preserve the reference invariant', async () => {
  state.products = [{
    _id: productId,
    name: 'Existing table',
    category: otherCategoryId,
    price: 1200,
    description: 'Existing item',
    isActive: true,
  }];

  const [updated, deleted] = await Promise.all([
    request(`/admin/products/${productId}`, {
      method: 'PATCH',
      body: { category: categoryId },
    }),
    request(`/admin/categories/${categoryId}`, { method: 'DELETE' }),
  ]);

  assert.ok(
    (updated.status === 200 && deleted.status === 409)
      || (updated.status === 400 && deleted.status === 200),
  );
  assert.equal(
    state.products.every((product) =>
      state.categories.some((category) => matchesId(category._id, product.category)),
    ),
    true,
  );
  if (updated.status === 200) assert.equal(state.products[0].category, categoryId);
  else assert.equal(state.products[0].category, otherCategoryId);
});

test('Transient write conflict retries safely and commits once', async () => {
  transientCommitFailures = 1;
  const result = await request('/admin/products', {
    method: 'POST',
    body: validProduct(),
  });
  assert.equal(result.status, 201);
  assert.equal(transactionsStarted, 2);
  assert.equal(state.products.length, 1);
  assert.equal(state.products[0].category, categoryId);
});

test('Exhausted transaction conflicts fail safely without partial product writes', async () => {
  transientCommitFailures = 10;
  const result = await request('/admin/products', {
    method: 'POST',
    body: validProduct(),
  });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { message: 'Internal server error.' });
  assert.equal(transactionsStarted, 3);
  assert.equal(state.products.length, 0);
  assert.equal(state.categories.find((category) => category._id === categoryId).referenceVersion, 0);
});

test('Reassignment to a missing category is rejected without changing the product', async () => {
  state.products = [{
    _id: productId,
    name: 'Existing table',
    category: otherCategoryId,
    price: 1200,
    description: 'Existing item',
    isActive: true,
  }];
  const result = await request(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: { category: '507f1f77bcf86cd799439099' },
  });
  assert.equal(result.status, 400);
  assert.equal(state.products[0].category, otherCategoryId);
});
