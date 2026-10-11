import { test, expect } from '@playwright/test';
import path from 'node:path';

const asset = (name) => path.resolve('public/images', name);
const productName = 'Preview Sheesham Dining Chair';

test('login and settings are honest UI previews, with no credential persistence or API calls', async ({
  page,
}) => {
  const apiCalls = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' || new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
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
  await expect(page.getByRole('alert')).toContainText('Authentication is not connected');
  await expect(page.locator('#login-password')).toHaveValue('');
  await page.getByRole('link', { name: 'Open dashboard preview' }).click();
  await expect(page).toHaveURL('/admin/dashboard');
  await page.getByLabel('Admin profile options').click();
  await page.getByRole('link', { name: 'Profile & settings' }).click();
  await expect(page).toHaveURL('/admin/settings');
  await page.getByLabel('Display name').fill('Sample Manager');
  await page.getByLabel('Email (preview only)').fill('invalid');
  await page.getByRole('button', { name: 'Save preview profile' }).click();
  await expect(page.getByRole('alert')).toContainText('valid preview email');
  await page.getByLabel('Email (preview only)').fill('manager@example.test');
  await page.getByRole('button', { name: 'Save preview profile' }).click();
  await expect(page.getByRole('status')).toContainText('Preview profile updated');
  await expect(page.getByLabel('Admin profile options')).toContainText('Sample Manager');
  await page.getByRole('button', { name: 'Preview password change' }).click();
  await expect(page.getByRole('alert')).toContainText('Complete all three');
  await page.locator('#settings-password-current').fill('sample-current');
  await page.locator('#settings-password-next').fill('short');
  await page.locator('#settings-password-confirm').fill('short');
  await page.getByRole('button', { name: 'Preview password change' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 12');
  await page.locator('#settings-password-next').fill('sample-new-password');
  await page.getByRole('button', { name: 'Preview password change' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.locator('#settings-password-confirm').fill('sample-new-password');
  await page.getByRole('button', { name: 'Preview password change' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Password updates' })).toContainText(
    'No credentials were verified, sent, or stored',
  );
  for (const key of ['current', 'next', 'confirm'])
    await expect(page.locator(`#settings-password-${key}`)).toHaveValue('');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(apiCalls).toEqual([]);
  await page.getByRole('link', { name: 'Logout (exit UI preview)', exact: true }).click();
  await expect(page).toHaveURL('/admin/login');
  await page.getByRole('link', { name: 'Open dashboard preview' }).click();
  await expect(page.getByLabel('Admin profile options')).toContainText('Sample Manager');
  await page.reload();
  await expect(page.getByLabel('Admin profile options')).toContainText('Admin preview');
});

async function fillProduct(page) {
  await page.getByLabel('Product name').fill(productName);
  await page.locator('#product-category').selectOption('chairs');
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

test('add/edit product, normalized tags, and main-image selection persist through preview navigation', async ({
  page,
}) => {
  await page.goto('/admin/products/new');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('highlighted fields');
  await expect(page.getByLabel('Product name')).toHaveAttribute('aria-invalid', 'true');
  await fillProduct(page);
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
  await page
    .getByLabel('Select product images')
    .setInputFiles([asset('chair.webp'), asset('accent-chair.webp')]);
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(2);
  const second = await page.getByRole('img', { name: /^Product preview 2/ }).getAttribute('src');
  await page.getByRole('button', { name: 'Set image 2 as main', exact: true }).click();
  await expect(page.getByRole('img', { name: /^Product preview 1/ })).toHaveAttribute(
    'src',
    second,
  );
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page).toHaveURL('/admin/products');
  await expect(
    page.getByRole('status').filter({ hasText: 'added in the UI preview' }),
  ).toBeVisible();
  const row = page.getByTestId('admin-product-row').filter({ hasText: productName });
  await expect(row).toBeVisible();
  await expect(row).toContainText('₹14,500.5');
  await expect(row.locator('img')).toHaveAttribute('src', second);
  await row.getByRole('link', { name: `Edit ${productName}`, exact: true }).click();
  await expect(page.getByLabel('Product name')).toHaveValue(productName);
  await expect(page.getByLabel('Price (₹ INR)')).toHaveValue('14500.5');
  await expect(page.getByLabel('Length (cm)')).toHaveValue('55');
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(2);
  await page.getByLabel('Product name').fill('Updated Sheesham Dining Chair');
  await page.getByRole('button', { name: 'Remove tag reading corner', exact: true }).click();
  await page.getByRole('button', { name: 'Remove image 2', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL('/admin/products');
  await expect(
    page.getByTestId('admin-product-row').filter({ hasText: 'Updated Sheesham Dining Chair' }),
  ).toBeVisible();
  await page.getByLabel('Search admin products').fill('wooden chair');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
  await page.getByRole('link', { name: 'Edit Updated Sheesham Dining Chair', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove tag reading corner' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(1);
});

test('product filters, sorting, pagination, and delete confirmation work without changing the public catalog', async ({
  page,
}) => {
  await page.goto('/admin/products');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(8);
  await page.getByRole('button', { name: 'Next product page' }).click();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(4);
  await page.getByLabel('Search admin products').fill('reading corner');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
  await expect(page.getByTestId('admin-product-row')).toContainText('Elm Accent Chair');
  await page.getByLabel('Filter by category').selectOption('sofas');
  await expect(page.getByRole('heading', { name: 'No matching pieces.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
  await page.getByLabel('Sort admin products').selectOption('price-asc');
  await expect(page.getByTestId('admin-product-row').first()).toContainText('Nook Side Table');
  await page.getByLabel('Sort admin products').selectOption('price-desc');
  await expect(page.getByTestId('admin-product-row').first()).toContainText('Verdant Dining Set');
  await page.getByLabel('Filter by category').selectOption('sofas');
  await expect(page.getByTestId('admin-product-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Olive Lounge Sofa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this product?' });
  await expect(dialog).toContainText('Olive Lounge Sofa');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Olive Lounge Sofa', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
  await expect(
    page.getByRole('status').filter({ hasText: 'deleted from the UI preview' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('link', { name: 'Overview' })
    .click();
  await expect(
    page
      .getByRole('heading', { name: 'Total products', exact: true })
      .locator('../..')
      .getByText('11', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'View website', exact: true }).click();
  await page.getByRole('link', { name: 'Explore collection', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(12);
  await expect(
    page.getByRole('link', { name: 'View Olive Lounge Sofa', exact: true }),
  ).toBeVisible();
});

test('categories support add, rename, duplicate prevention, and safe deletion', async ({
  page,
}) => {
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add a category' });
  await editor.getByLabel('Category name').fill('  SOFAS  ');
  await editor.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('already exists');
  await editor.getByLabel('Category name').fill('Home Decor');
  await editor.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByTestId('admin-category-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'Edit category Home Decor', exact: true }).click();
  await page.getByLabel('Category name').fill('Home Accents');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home Accents', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('link', { name: 'Products', exact: true })
    .click();
  await page.getByRole('link', { name: 'Edit Olive Lounge Sofa', exact: true }).click();
  await page.locator('#product-category').selectOption({ label: 'Home Accents' });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL('/admin/products');
  await expect(
    page.getByTestId('admin-product-row').filter({ hasText: 'Olive Lounge Sofa' }),
  ).toContainText('Home Accents');
  await page
    .getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('link', { name: 'Categories', exact: true })
    .click();
  const card = page.getByTestId('admin-category-card').filter({ hasText: 'Home Accents' });
  await expect(card).toContainText('1 product');
  await card.getByRole('button', { name: 'Delete category Home Accents' }).click();
  const blocked = page.getByRole('dialog', { name: 'This category has products.' });
  await expect(
    blocked.getByRole('button', { name: 'Delete category', exact: true }),
  ).toBeDisabled();
  await blocked.getByRole('button', { name: 'Cancel', exact: true }).click();
  await card.getByRole('link', { name: 'View products', exact: true }).click();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(1);
  await page.getByRole('link', { name: 'Edit Olive Lounge Sofa', exact: true }).click();
  await page.locator('#product-category').selectOption('sofas');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL('/admin/products');
  await page
    .getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('link', { name: 'Categories', exact: true })
    .click();
  await card.getByRole('button', { name: 'Delete category Home Accents' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete this category?' });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Delete category Home Accents' }).click();
  await confirmation.getByRole('button', { name: 'Delete category', exact: true }).click();
  await expect(card).toHaveCount(0);
});

test('image selection rejects unsupported, oversized, corrupt, and excess files', async ({
  page,
}) => {
  await page.goto('/admin/products/new');
  const upload = page.getByLabel('Select product images');
  await upload.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('use JPEG, PNG, or WebP');
  await upload.setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toContainText('5 MB');
  await upload.setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('invalid bitmap'),
  });
  await expect(page.getByRole('alert')).toContainText('not a readable image');
  await upload.setInputFiles(Array.from({ length: 9 }, () => asset('chair.webp')));
  await expect(page.getByRole('alert')).toContainText('The limit is 8');
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(0);
  await upload.setInputFiles(asset('chair.webp'));
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('mobile navigation, add/edit/delete cards, and breakpoint transitions work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto('/admin/dashboard');
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
  await fillProduct(page);
  await page.getByLabel('Select product images').setInputFiles(asset('chair.webp'));
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  const card = page.getByTestId('admin-product-card').filter({ hasText: productName });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: `Edit ${productName}`, exact: true }).click();
  await page.getByLabel('Product name').fill('Mobile Preview Chair');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByTestId('admin-product-card')
    .getByRole('button', { name: 'Delete Mobile Preview Chair', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByTestId('admin-product-card').filter({ hasText: 'Mobile Preview Chair' }),
  ).toHaveCount(0);
  await page.getByLabel('Search admin products').fill('reading corner');
  await expect(page.getByTestId('admin-product-card')).toHaveCount(1);
  await page.getByLabel('Filter by category').selectOption('sofas');
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
      'products/olive-lounge-sofa/edit',
      'categories',
      'settings',
    ]) {
      await page.goto(`/admin/${route}`);
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
