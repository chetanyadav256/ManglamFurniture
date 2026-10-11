import { expect, test } from '@playwright/test';
import { mockAdminAuth, navigateWithinAdmin, signInToAdmin } from './adminAuthFixture';

const categoryId = '507f1f77bcf86cd799439014';
const productId = '507f1f77bcf86cd799439013';
const imageUrl = 'https://images.example.test/chair.webp';

async function finishMockLogin(page) {
  await page.goto('/admin/login');
  await page.getByLabel('Admin email').fill('admin@example.test');
  await page.locator('#login-password').fill('mock-admin-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL('**/admin/dashboard');
}

function product(overrides = {}) {
  return {
    id: productId,
    name: 'Oak dining chair',
    category: { id: categoryId, name: 'Dining', slug: 'dining' },
    price: 12000,
    description: 'A solid oak dining chair for everyday use.',
    material: 'Oak',
    color: 'Natural',
    dimensions: { length: 45, width: 50, height: 90 },
    tags: ['dining chair', 'oak'],
    images: [
      {
        url: imageUrl,
        publicId: 'furniture/chair',
        imageId: 'a'.repeat(64),
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

async function installCatalog(page, state) {
  state.products ??= [product()];
  state.requests ??= [];
  await page.route('**/api/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        categories: [{ id: categoryId, name: 'Dining', slug: 'dining' }],
      }),
    }),
  );
  await page.route('**/api/products*', (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page') || 1);
    state.requests.push(requestedPage);
    const start = (requestedPage - 1) * 100;
    const items = state.products
      .filter((item) => item.isActive !== false)
      .slice(start, start + 100);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        products: items,
        pagination: {
          total: state.products.filter((item) => item.isActive !== false).length,
          page: requestedPage,
          limit: 100,
          totalPages: Math.ceil(
            state.products.filter((item) => item.isActive !== false).length / 100,
          ),
        },
      }),
    });
  });
  await page.route('**/api/admin/products/*/images**', async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(
      /\/admin\/products\/([^/]+)\/images(?:\/([^/]+)(?:\/main)?)?$/,
    );
    const item = state.products.find((candidate) => candidate.id === match?.[1]);
    if (!item) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Active product not found.' }),
      });
      return;
    }
    const method = route.request().method();
    state.imageActions ??= [];
    state.imageActions.push({ method, path: url.pathname });
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ product: item }),
      });
      return;
    }
    const imageId = match[2];
    if (method === 'POST') {
      if (state.failFirstImageUpload && !state.failedImageUpload) {
        state.failedImageUpload = true;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Product image limit changed. Refresh and retry.',
          }),
        });
        return;
      }
      const fileCount = (route.request().postData() || '').match(/name="images"/g)?.length || 1;
      const additions = Array.from({ length: fileCount }, (_, index) => ({
        url: `https://images.example.test/upload-${index}.webp`,
        publicId: `furniture/upload-${index}`,
        imageId: `${(index + 2).toString(16)}`.repeat(64),
      }));
      item.images = [...item.images, ...additions];
    } else if (url.pathname.endsWith('/main')) {
      const selected = item.images.find((image) => image.imageId === imageId);
      item.images = [selected, ...item.images.filter((image) => image !== selected)];
    } else {
      item.images = item.images.filter((image) => image.imageId !== imageId);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ product: item }),
    });
  });
}

async function fillProductForm(page, name = 'Walnut lounge chair') {
  await page.locator('#product-name').fill(name);
  await page.locator('#product-category').selectOption(categoryId);
  await page.locator('#product-price').fill('21999.5');
  await page
    .locator('#product-description')
    .fill('A carefully crafted chair for a calm living room.');
  await page.locator('#product-material').fill('Walnut');
  await page.locator('#product-color').fill('Warm brown');
  await page.locator('#product-length').fill('72');
  await page.locator('#product-width').fill('84');
  await page.locator('#product-height').fill('95');
  await page.locator('#product-tag-input').fill('living room');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

test('product list loads every public page and identifies its active-only limitation', async ({
  page,
}) => {
  const state = {
    products: Array.from({ length: 101 }, (_, index) =>
      product({
        id: (index + 1).toString(16).padStart(24, '0'),
        name: index === 0 ? 'Oak dining chair' : `Oak side table ${index}`,
      }),
    ),
  };
  state.products.push(
    product({ id: '507f1f77bcf86cd799439099', name: 'Inactive chair', isActive: false }),
  );
  await installCatalog(page, state);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/products?category=dining');

  await expect(page.getByRole('link', { name: 'Oak dining chair', exact: true })).toBeVisible();
  await expect(page.getByText('101 products found')).toBeVisible();
  await expect(page.getByLabel('Filter by category')).toHaveValue(categoryId);
  await expect(page.getByText('Inactive chair')).toHaveCount(0);
  await expect(page.getByRole('note')).toContainText('only returns active products');
  expect(state.requests).toContain(1);
  expect(state.requests).toContain(2);
});

test('Add Product posts mapped schema fields, refreshes from MongoDB, and does not require images', async ({
  page,
}) => {
  const state = { products: [] };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  let posted;
  await page.route('**/api/admin/products', async (route) => {
    expect(route.request().headers().authorization).toBeTruthy();
    posted = route.request().postDataJSON();
    const created = product({
      id: '507f1f77bcf86cd799439016',
      name: posted.name,
      category: { id: posted.category, name: 'Dining', slug: 'dining' },
      price: posted.price,
      description: posted.description,
      material: posted.material,
      color: posted.color,
      dimensions: posted.dimensions,
      tags: posted.tags,
      images: [],
    });
    state.products = [created];
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ product: created }),
    });
  });

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  await expect(page.getByRole('option', { name: 'Dining' })).toBeAttached();
  await fillProductForm(page);
  await expect(page.getByLabel('Select product images')).toBeEnabled();
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page).toHaveURL('/admin/products');
  await expect(page.getByRole('link', { name: 'Walnut lounge chair', exact: true })).toBeVisible();
  expect(posted).toEqual({
    name: 'Walnut lounge chair',
    category: categoryId,
    price: 21999.5,
    description: 'A carefully crafted chair for a calm living room.',
    material: 'Walnut',
    color: 'Warm brown',
    dimensions: { length: 72, width: 84, height: 95 },
    tags: ['living room'],
  });
  expect(posted).not.toHaveProperty('images');
  expect(state.requests.length).toBeGreaterThan(1);
});

test('Edit Product sends a partial update, retains existing images, and refreshes listing', async ({
  page,
}) => {
  const state = { products: [product()] };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  let patched;
  await page.route(`**/api/admin/products/${productId}`, async (route) => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().headers().authorization).toBeTruthy();
    patched = route.request().postDataJSON();
    state.products = [product({ price: patched.price })];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ product: state.products[0] }),
    });
  });

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products');
  await page.getByRole('link', { name: 'Edit Oak dining chair' }).click();
  await page.locator('#product-price').fill('13500');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page).toHaveURL('/admin/products');
  await expect(page.getByTestId('admin-product-row').locator('td').nth(2)).toHaveText('₹13,500');
  expect(patched).toMatchObject({ price: 13500, category: categoryId });
  expect(patched).not.toHaveProperty('images');
  expect(state.requests.length).toBeGreaterThan(1);
});

test('Deactivate requires confirmation, calls the soft-delete endpoint, then refreshes active listing', async ({
  page,
}) => {
  const state = { products: [product()] };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  let confirmed = false;
  await page.route(`**/api/admin/products/${productId}`, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers().authorization).toBeTruthy();
    confirmed = true;
    state.products = [product({ isActive: false })];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Product deactivated.', productId }),
    });
  });

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products');
  await page.getByRole('button', { name: 'Delete Oak dining chair' }).click();
  await expect(page.getByRole('heading', { name: 'Deactivate this product?' })).toBeVisible();
  expect(confirmed).toBe(false);
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();

  await expect(page.getByText('No active products found.')).toBeVisible();
  await expect(
    page.getByText('has been deactivated and removed from the public catalog.'),
  ).toBeVisible();
  expect(confirmed).toBe(true);
  expect(state.requests.length).toBeGreaterThan(1);
});

test('backend validation errors are shown and do not clear entered form values', async ({
  page,
}) => {
  const state = { products: [] };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  await page.route('**/api/admin/products', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Category does not exist.' }),
    }),
  );

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  await fillProductForm(page);
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page.getByRole('alert')).toHaveText('Category does not exist.');
  await expect(page.locator('#product-name')).toHaveValue('Walnut lounge chair');
  await expect(page).toHaveURL('/admin/products/new');
});

test('unauthorized product writes clear the in-memory admin session and return to login', async ({
  page,
}) => {
  const state = { products: [] };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  await page.route('**/api/admin/products', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid or expired authentication token.' }),
    }),
  );

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  await fillProductForm(page);
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page).toHaveURL('/admin/login');
});

test('new product saves before uploading selected images using the authenticated multipart endpoint', async ({
  page,
}) => {
  const state = { products: [] };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  let productCreates = 0;
  let multipartContentType = '';
  await page.route('**/api/admin/products', async (route) => {
    productCreates += 1;
    const body = route.request().postDataJSON();
    const created = product({
      ...body,
      id: productId,
      category: { id: categoryId, name: 'Dining', slug: 'dining' },
      images: [],
    });
    state.products = [created];
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ product: created }),
    });
  });
  await page.route(`**/api/admin/products/${productId}/images`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(route.request().headers().authorization).toBeTruthy();
    multipartContentType = route.request().headers()['content-type'];
    expect(route.request().postData()).toContain('name="images"');
    const uploaded = {
      ...state.products[0],
      images: [
        {
          url: 'https://images.example.test/uploaded.webp',
          publicId: 'furniture/uploaded',
          imageId: 'b'.repeat(64),
        },
      ],
    };
    state.products = [uploaded];
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ product: uploaded }),
    });
  });

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  await fillProductForm(page);
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Select product images').setInputFiles({
    name: 'chair.png',
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  });
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page).toHaveURL('/admin/products');
  expect(productCreates).toBe(1);
  expect(multipartContentType).toMatch(/^multipart\/form-data; boundary=/);
  expect(state.products[0].images[0].imageId).toBe('b'.repeat(64));
  expect(state.imageActions.map((action) => action.method)).toContain('GET');
});

test('partial new-product upload failure keeps the file and retry does not create a duplicate product', async ({
  page,
}) => {
  const state = { products: [], failFirstImageUpload: true };
  await installCatalog(page, state);
  await mockAdminAuth(page);
  let productCreates = 0;
  await page.route('**/api/admin/products', async (route) => {
    productCreates += 1;
    const body = route.request().postDataJSON();
    const created = product({
      ...body,
      id: productId,
      category: { id: categoryId, name: 'Dining', slug: 'dining' },
      images: [],
    });
    state.products = [created];
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ product: created }),
    });
  });

  await finishMockLogin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  await fillProductForm(page);
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Select product images').setInputFiles({
    name: 'chair.png',
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  });
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('alert')).toContainText('Product details were saved');
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page).toHaveURL('/admin/products');
  expect(productCreates).toBe(1);
});

test('existing image main selection and removal use backend imageIds and update the preview order', async ({
  page,
}) => {
  const state = {
    products: [
      product({
        images: [
          { url: imageUrl, publicId: 'furniture/first', imageId: 'a'.repeat(64) },
          {
            url: 'https://images.example.test/second.webp',
            publicId: 'furniture/second',
            imageId: 'b'.repeat(64),
          },
        ],
      }),
    ],
  };
  await installCatalog(page, state);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/products');
  await page.getByRole('link', { name: 'Edit Oak dining chair' }).click();
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'Set image 2 as main' }).click();
  await expect(page.getByRole('button', { name: 'Image 1 is main image' })).toBeVisible();
  expect(state.imageActions).toContainEqual({
    method: 'PATCH',
    path: `/api/admin/products/${productId}/images/${'b'.repeat(64)}/main`,
  });
  await page.getByRole('button', { name: 'Remove image 1' }).click();
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(1);
  expect(state.imageActions).toContainEqual({
    method: 'DELETE',
    path: `/api/admin/products/${productId}/images/${'b'.repeat(64)}`,
  });
});

test('image selection enforces the five-image total and supported file types', async ({ page }) => {
  const state = { products: [] };
  await installCatalog(page, state);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  const upload = page.getByLabel('Select product images');
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await upload.setInputFiles(
    Array.from({ length: 5 }, (_, index) => ({
      name: `chair-${index}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(base64, 'base64'),
    })),
  );
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(5);
  await upload.setInputFiles([
    { name: 'sixth.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') },
  ]);
  await expect(page.getByRole('alert')).toContainText('limit is 5');
  await page.getByRole('button', { name: 'Remove image 1' }).click();
  await upload.setInputFiles({
    name: 'invalid.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('use JPEG, PNG, or WebP');
});
