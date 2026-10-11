import { test, expect } from '@playwright/test';
import { navigateWithinAdmin, signInToAdmin } from './adminAuthFixture';
import { mockShopApi } from './shopApiFixture';
import { mockAdminCategoryApi } from './adminCategoryFixture';

test.beforeEach(async ({ page }) => {
  await mockShopApi(page);
  await signInToAdmin(page);
});
import path from 'node:path';

async function expectBelowHeader(page, locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const header = await page.locator('header').boundingBox();
      return (
        box.y >= header.y + header.height + 8 && box.y + box.height <= page.viewportSize().height
      );
    })
    .toBe(true);
}

for (const width of [393, 1024]) {
  test(`admin links, route recovery, and scroll position work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await navigateWithinAdmin(page, '/admin/dashboard');
    for (const [name, route] of [
      ['Products', 'products'],
      ['Categories', 'categories'],
      ['Settings', 'settings'],
      ['Overview', 'dashboard'],
    ]) {
      let navigation = page.getByRole('navigation', { name: 'Admin navigation', exact: true });
      if (width < 1024) {
        await page.getByRole('button', { name: 'Open admin navigation', exact: true }).click();
        navigation = page.getByRole('dialog', { name: 'Catalog navigation' });
      }
      await navigation.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(`/admin/${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    }
    await page.getByRole('link', { name: 'Create a product', exact: true }).click();
    await expect(page).toHaveURL('/admin/products/new');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL('/admin/products');
    await page.goBack();
    await expect(page).toHaveURL('/admin/products/new');
    await navigateWithinAdmin(page, '/admin/products/missing-product/edit');
    await expect(page.getByRole('heading', { name: 'This piece isn’t here.' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to products', exact: true }).click();
    await expect(page).toHaveURL('/admin/products');
    await navigateWithinAdmin(page, '/admin/missing-page');
    await page.getByRole('link', { name: 'Back to overview', exact: true }).click();
    await expect(page).toHaveURL('/admin/dashboard');
  });
}

test('renaming a populated category preserves its products and deletion protection', async ({
  page,
}) => {
  await mockAdminCategoryApi(page);
  await navigateWithinAdmin(page, '/admin/categories');
  await page.getByRole('button', { name: 'Edit category Chairs', exact: true }).click();
  await page.getByLabel('Category name').fill('  beds ');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await page.getByLabel('Category name').fill('Accent Seating');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  const category = page.getByTestId('admin-category-card').filter({ hasText: 'Accent Seating' });
  await expect(category).toContainText('2 active products');
  await category.getByRole('link', { name: 'View products', exact: true }).click();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(2);
  for (const row of await page.getByTestId('admin-product-row').all())
    await expect(row).toContainText('Accent Seating');
  await page
    .getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('link', { name: 'Categories', exact: true })
    .click();
  await category
    .getByRole('button', { name: 'Delete category Accent Seating', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'This category has products.' });
  await expect(dialog).toContainText('active products');
  await expect(dialog.getByRole('button', { name: 'Delete category', exact: true })).toBeDisabled();
});

test('mobile image picker previews supported files, tracks a preferred main image, and removes selections', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await navigateWithinAdmin(page, '/admin/products/new');
  const fixtures = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return ['image/png', 'image/jpeg'].map((type) => canvas.toDataURL(type).split(',')[1]);
  });
  const upload = page.getByLabel('Select product images');
  await upload.setInputFiles([
    { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(fixtures[0], 'base64') },
    { name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(fixtures[1], 'base64') },
  ]);
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(2);
  await upload.setInputFiles(path.resolve('public/images/chair.webp'));
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(3);
  await page.getByRole('button', { name: 'Set image 3 as main', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Image 3 is main image' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove image 1', exact: true }).click();
  await expect(page.getByRole('img', { name: /Product preview/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Choose product images' })).toContainText(
    '2/5 images',
  );
});

test('Unicode tag normalization, duplicate prevention, and tag limits work', async ({ page }) => {
  await navigateWithinAdmin(page, '/admin/products/new');
  const input = page.getByLabel('Product tags');
  await input.fill('  ＷＯＯＤＥＮ\u00a0  CHAIR  ');
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Remove tag wooden chair', exact: true }),
  ).toBeVisible();
  await input.fill('Wooden chair');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already been added');
  await expect(
    page.getByRole('button', { name: 'Remove tag wooden chair', exact: true }),
  ).toHaveCount(1);
  await input.fill('x'.repeat(41));
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('40 characters');
  for (let i = 1; i < 12; i++) {
    await input.fill(`sample ${i}`);
    await input.press('Enter');
  }
  await input.fill('one too many');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('up to 12 tags');
  await expect(page.getByRole('button', { name: /^Remove tag / })).toHaveCount(12);
});

for (const width of [360, 393]) {
  test(`Settings feedback remains visible below the sticky header with a short viewport at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 400 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navigateWithinAdmin(page, '/admin/settings');
    const submit = page.getByRole('button', { name: 'Change password' });
    await submit.click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Complete all three password fields');
    await expectBelowHeader(page, alert);
    // Repeating the same invalid submission must reveal the same error again.
    await submit.click();
    await expectBelowHeader(page, alert);
    await page.locator('#settings-password-current').fill('sample-current');
    await page.locator('#settings-password-next').fill('sample-new-password');
    await page.locator('#settings-password-confirm').fill('sample-new-password');
    await page.route('**/api/admin/me/password', (route) => route.fulfill({ status: 400, json: { message: 'Current password is incorrect.' } }));
    await submit.click();
    const status = page.getByRole('alert').filter({ hasText: 'Current password is incorrect.' });
    await expectBelowHeader(page, status);
    await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`settings-feedback-${width}.png`) });
  });
}
