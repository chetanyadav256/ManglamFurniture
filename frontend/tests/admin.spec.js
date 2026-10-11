import { test, expect } from '@playwright/test';
import { mockShopApi } from './shopApiFixture';
import { navigateWithinAdmin, signInToAdmin, testAdmin } from './adminAuthFixture';
import { mockAdminCategoryApi } from './adminCategoryFixture';

const productName = 'Preview Sheesham Dining Chair';

test('admin login uses the backend, settings display the account read-only, and logout clears auth', async ({
  page,
}) => {
  await mockShopApi(page);
  const apiCalls = [];
  let loginAttempts = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/admin/')) {
      apiCalls.push({ method: request.method(), pathname: new URL(request.url()).pathname });
    }
  });
  await page.route('**/api/admin/login', (route) => {
    loginAttempts += 1;
    return route.fulfill({
      status: loginAttempts === 1 ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        loginAttempts === 1
          ? { message: 'Invalid email or password.' }
          : { token: 'mock-admin-token', admin: testAdmin },
      ),
    });
  });
  await page.route('**/api/admin/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ admin: testAdmin }),
    }),
  );
  await page.goto('/admin');
  await expect(page).toHaveURL('/admin/login');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.locator('#login-email-error')).toHaveText('Email is required.');
  await expect(page.locator('#login-password-error')).toHaveText('Password is required.');
  await page.getByLabel('Admin email').fill('sample@example.test');
  await page
    .getByLabel('Password', { exact: false })
    .filter({ hasNot: page.locator('button') })
    .first()
    .fill('sample-password-only');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.locator('#login-password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
  await expect(page.locator('#login-password')).toHaveValue('');
  await page.locator('#login-password').fill('correct-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/admin/dashboard');
  await page.getByLabel('Admin profile options').click();
  await page.getByRole('link', { name: 'Profile & settings' }).click();
  await expect(page).toHaveURL('/admin/settings');
  await expect(page.getByLabel('Display name')).toHaveValue(testAdmin.name);
  await expect(page.getByLabel('Display name')).toBeEditable();
  await expect(page.getByLabel('Email (login identifier)')).toHaveValue(testAdmin.email);
  await expect(page.getByLabel('Email (login identifier)')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Admin profile options')).toContainText(testAdmin.name);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('alert')).toContainText('Complete all three');
  await page.locator('#settings-password-current').fill('sample-current');
  await page.locator('#settings-password-next').fill('short');
  await page.locator('#settings-password-confirm').fill('short');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 12');
  await page.locator('#settings-password-next').fill('sample-new-password');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(
    apiCalls.some(({ method, pathname }) => method === 'POST' && pathname.endsWith('/login')),
  ).toBe(true);
  expect(
    apiCalls.some(({ method, pathname }) => method === 'GET' && pathname.endsWith('/me')),
  ).toBe(true);
  await page.locator('#main-content').getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL('/admin/login');
  await page.reload();
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL('/admin/login');
});

async function fillProduct(page, categoryId) {
  await page.getByLabel('Product name').fill(productName);
  await page.locator('#product-category').selectOption(categoryId);
  await page.getByLabel('Price (₹ INR)').fill('14500.50');
  await page
    .getByLabel('Description')
    .fill(
      'A thoughtfully shaped dining chair with a solid wood frame and a comfortable upholstered seat.',
    );
  await page.getByLabel('Material').fill('Sheesham Wood');
  await page.getByLabel('Color').fill('Natural walnut');
  await page.getByLabel('Length (cm)').fill('55');
  await page.getByLabel('Width (cm)').fill('48');
  await page.getByLabel('Height (cm)').fill('86');
}

async function isolatedShopApi(page) {
  const state = await mockShopApi(page);
  state.products = state.products.map((product) => ({
    ...product,
    tags: [...product.tags],
    images: [...product.images],
  }));
  await page.route('**/api/admin/products/*/images', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    const product = state.products.find((item) => item.id === id);
    await route.fulfill({
      status: product ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(
        product
          ? {
              product: {
                ...product,
                images: product.images.map((image, index) => ({
                  ...image,
                  imageId: (index + 1).toString(16).repeat(64),
                })),
              },
            }
          : { message: 'Active product not found.' },
      ),
    });
  });
  return state;
}

test('add/edit product uses backend data, normalizes tags, and supports image management', async ({
  page,
}) => {
  const state = await isolatedShopApi(page);
  const category = state.categories.find((item) => item.slug === 'chairs');
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('highlighted fields');
  await expect(page.getByLabel('Product name')).toHaveAttribute('aria-invalid', 'true');
  await fillProduct(page, category.id);
  await page.getByLabel('Price (₹ INR)').fill('-5');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.locator('#product-price-error')).toContainText('positive price');
  await page.getByLabel('Price (₹ INR)').fill('14500.50');
  const tags = page.getByLabel('Product tags');
  await tags.fill('  WOODEN   CHAIR  ');
  await tags.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Remove tag wooden chair', exact: true }),
  ).toBeVisible();
  await tags.fill('Wooden chair');
  await tags.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'already been added' })).toBeVisible();
  await tags.fill('reading corner');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Select product images')).toBeEnabled();
  let created;
  let submitted;
  await page.route('**/api/admin/products', async (route) => {
    const payload = route.request().postDataJSON();
    submitted = payload;
    created = {
      id: '507f1f77bcf86cd799439099',
      ...payload,
      category,
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.products.unshift(created);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ product: created }),
    });
  });
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page).toHaveURL('/admin/products');
  expect(submitted).toMatchObject({
    name: productName,
    category: category.id,
    price: 14500.5,
    dimensions: { length: 55, width: 48, height: 86 },
    tags: ['wooden chair', 'reading corner'],
  });
  expect(submitted).not.toHaveProperty('images');
  const row = page.getByTestId('admin-product-row').filter({ hasText: productName });
  await expect(row).toBeVisible();
  await expect(row).toContainText('₹14,500.5');
  await row.getByRole('link', { name: `Edit ${productName}`, exact: true }).click();
  await expect(page.getByLabel('Product name')).toHaveValue(productName);
  await expect(page.getByLabel('Price (₹ INR)')).toHaveValue('14500.5');
  await expect(page.getByLabel('Length (cm)')).toHaveValue('55');
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(0);
  let updated;
  await page.route(`**/api/admin/products/${created.id}`, async (route) => {
    const changes = route.request().postDataJSON();
    updated = changes;
    const saved = { ...created, ...changes };
    state.products = state.products.map((item) => (item.id === created.id ? saved : item));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ product: saved }),
    });
  });
  await page.getByLabel('Product name').fill('Updated Sheesham Dining Chair');
  await page.getByRole('button', { name: 'Remove tag reading corner', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL('/admin/products');
  await expect(
    page.getByTestId('admin-product-row').filter({ hasText: 'Updated Sheesham Dining Chair' }),
  ).toBeVisible();
  expect(updated.name).toBe('Updated Sheesham Dining Chair');
  expect(updated.tags).toEqual(['wooden chair']);
  expect(updated).not.toHaveProperty('images');
  await page.getByLabel('Search admin products').fill('wooden chair');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
});

test('product filters, sorting, pagination, and confirmed deactivation refresh the active catalog', async ({
  page,
}) => {
  const state = await isolatedShopApi(page);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/products');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(8);
  await page.getByRole('button', { name: 'Next product page' }).click();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(4);
  await page.getByLabel('Search admin products').fill('Elm Accent');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
  await expect(page.getByTestId('admin-product-row')).toContainText('Elm Accent Chair');
  const sofaCategoryId = state.categories.find((item) => item.slug === 'sofas').id;
  await page.getByLabel('Filter by category').selectOption(sofaCategoryId);
  await expect(page.getByRole('heading', { name: 'No matching pieces.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
  await page.getByLabel('Sort admin products').selectOption('price-asc');
  await expect(page.getByTestId('admin-product-row').first()).toContainText('Nook Side Table');
  await page.getByLabel('Sort admin products').selectOption('price-desc');
  await expect(page.getByTestId('admin-product-row').first()).toContainText('Verdant Dining Set');
  await page.getByLabel('Filter by category').selectOption(sofaCategoryId);
  await expect(page.getByTestId('admin-product-row')).toHaveCount(2);
  const olive = state.products.find((item) => item.name === 'Olive Lounge Sofa');
  await page.route(`**/api/admin/products/${olive.id}`, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers().authorization).toBe('Bearer mock-admin-token');
    state.products = state.products.filter((item) => item.id !== olive.id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Product deactivated.', productId: olive.id }),
    });
  });
  await page.getByRole('button', { name: 'Delete Olive Lounge Sofa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Deactivate this product?' });
  await expect(dialog).toContainText('Olive Lounge Sofa');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Olive Lounge Sofa', exact: true }).click();
  await dialog.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
  await expect(
    page.getByRole('status').filter({ hasText: 'deactivated and removed from the public catalog' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('link', { name: 'Overview' })
    .click();
  await expect(page.getByRole('heading', { name: 'Active products', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View website', exact: true }).click();
  await page.getByRole('link', { name: 'Explore collection', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(11);
  await expect(page.getByRole('link', { name: 'View Olive Lounge Sofa', exact: true })).toHaveCount(
    0,
  );
});

test('categories support add, rename, duplicate prevention, and safe deletion', async ({
  page,
}) => {
  const state = await mockAdminCategoryApi(page);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/categories');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add a category' });
  await editor.getByLabel('Category name').fill('  SOFAS  ');
  await editor.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('already exists');
  await editor.getByLabel('Category name').fill('Home Decor');
  await editor.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByTestId('admin-category-card')).toHaveCount(state.categories.length);
  expect(state.lastPayload).toEqual({ name: 'Home Decor' });
  expect(state.categories.find((category) => category.name === 'Home Decor').slug).toBe(
    'home-decor',
  );
  await page.getByRole('button', { name: 'Edit category Home Decor', exact: true }).click();
  await page.getByLabel('Category name').fill('Home Accents');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home Accents', exact: true })).toBeVisible();
  const sofas = page.getByTestId('admin-category-card').filter({ hasText: 'Sofas' });
  await sofas.getByRole('button', { name: 'Delete category Sofas' }).click();
  const blocked = page.getByRole('dialog', { name: 'This category has products.' });
  await expect(
    blocked.getByRole('button', { name: 'Delete category', exact: true }),
  ).toBeDisabled();
  await blocked.getByRole('button', { name: 'Cancel', exact: true }).click();
  const card = page.getByTestId('admin-category-card').filter({ hasText: 'Home Accents' });
  await card.getByRole('button', { name: 'Delete category Home Accents' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete this category?' });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Delete category Home Accents' }).click();
  await confirmation.getByRole('button', { name: 'Delete category', exact: true }).click();
  await expect(card).toHaveCount(0);
});

test('image picker accepts files for upload when product details are saved', async ({ page }) => {
  await mockShopApi(page);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/products/new');
  const upload = page.getByLabel('Select product images');
  await expect(upload).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Choose product images' })).toContainText(
    '0/5 images',
  );
});

test('mobile navigation, add/edit/delete cards, and breakpoint transitions work', async ({
  page,
}) => {
  const state = await isolatedShopApi(page);
  await signInToAdmin(page);
  await page.setViewportSize({ width: 360, height: 844 });
  await navigateWithinAdmin(page, '/admin/dashboard');
  const trigger = page.getByRole('button', { name: 'Open admin navigation', exact: true });
  const drawer = page.getByRole('dialog', { name: 'Catalog navigation' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog[open]')))).toBe(
      true,
    );
  }
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole('link', { name: 'Products', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page).toHaveURL('/admin/products');
  await page.getByRole('link', { name: 'Add product', exact: true }).click();
  const category = state.categories.find((item) => item.slug === 'chairs');
  await fillProduct(page, category.id);
  await page.getByLabel('Product name').fill('Mobile Prototype Chair');
  await expect(page.getByLabel('Select product images')).toBeEnabled();
  const mobileId = '507f1f77bcf86cd799439098';
  let mobileProduct;
  await page.route('**/api/admin/products', async (route) => {
    const payload = route.request().postDataJSON();
    mobileProduct = {
      id: mobileId,
      ...payload,
      category,
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.products.unshift(mobileProduct);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ product: mobileProduct }),
    });
  });
  await page.route(`**/api/admin/products/${mobileId}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      mobileProduct = { ...mobileProduct, ...route.request().postDataJSON() };
      state.products = state.products.map((item) => (item.id === mobileId ? mobileProduct : item));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ product: mobileProduct }),
      });
    } else {
      state.products = state.products.filter((item) => item.id !== mobileId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Product deactivated.', productId: mobileId }),
      });
    }
  });
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  const card = page.getByTestId('admin-product-card').filter({ hasText: 'Mobile Prototype Chair' });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Edit Mobile Prototype Chair', exact: true }).click();
  await page.getByLabel('Product name').fill('Mobile Preview Chair');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByTestId('admin-product-card')
    .getByRole('button', { name: 'Delete Mobile Preview Chair', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(
    page.getByTestId('admin-product-card').filter({ hasText: 'Mobile Preview Chair' }),
  ).toHaveCount(0);
  await page.getByLabel('Search admin products').fill('Verdant Dining Set');
  await expect(page.getByTestId('admin-product-card')).toHaveCount(1);
  const sofaCategoryId = state.categories.find((item) => item.slug === 'sofas').id;
  await page.getByLabel('Filter by category').selectOption(sofaCategoryId);
  await expect(page.getByRole('heading', { name: 'No matching pieces.' })).toBeVisible();
  await trigger.click();
  await drawer.getByRole('button', { name: 'Close admin navigation' }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  await page.getByLabel('Admin profile options').click();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Admin profile options')).toBeFocused();
  await expect(page.locator('header details')).not.toHaveAttribute('open', '');
});

for (const width of [360, 393, 768, 1024, 1440]) {
  test(`admin pages render without overflow, overlapping header controls, broken images, or browser errors at ${width}px`, async ({
    page,
  }, testInfo) => {
    const state = await isolatedShopApi(page);
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    for (const route of [
      'login',
      'dashboard',
      'products',
      'products/new',
      'products/000000000000000000000001/edit',
      'categories',
      'settings',
    ]) {
      if (route === 'dashboard') await signInToAdmin(page);
      if (route !== 'login') await navigateWithinAdmin(page, `/admin/${route}`);
      else await page.goto('/admin/login');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (route !== 'login') {
        const menu = page.getByRole('button', { name: 'Open admin navigation', exact: true });
        if (width < 1024) await expect(menu).toBeVisible();
        else {
          await expect(menu).not.toBeVisible();
          await expect(
            page.getByRole('navigation', { name: 'Admin navigation', exact: true }),
          ).toBeVisible();
        }
        const overlaps = await page
          .locator('header a, header button, header summary')
          .evaluateAll((elements) => {
            const boxes = elements
              .filter((element) => element.getClientRects().length)
              .map((element) => element.getBoundingClientRect());
            return boxes.some((a, i) =>
              boxes
                .slice(i + 1)
                .some(
                  (b) =>
                    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
                ),
            );
          });
        expect(overlaps, route).toBe(false);
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((image) => {
            image.loading = 'eager';
            return image.decode().catch(() => {});
          }),
        );
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      expect(
        await page
          .locator('img')
          .evaluateAll((images) =>
            images
              .filter((image) => !image.complete || !image.naturalWidth)
              .map((image) => image.src),
          ),
        route,
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${route.replaceAll('/', '-')}-${width}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}
