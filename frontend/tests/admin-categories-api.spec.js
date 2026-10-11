import { expect, test } from '@playwright/test';
import { navigateWithinAdmin, signInToAdmin } from './adminAuthFixture';
import { mockAdminCategoryApi } from './adminCategoryFixture';

const newCategoryId = '507f1f77bcf86cd799439087';

async function openCategories(page, options) {
  const state = await mockAdminCategoryApi(page, options);
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/categories');
  return state;
}

test('category list comes from the public API and create refreshes product form options', async ({
  page,
}) => {
  const state = await openCategories(page);
  const initialCount = state.categories.length;
  await expect(page.getByTestId('admin-category-card')).toHaveCount(initialCount);
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a category' });
  await dialog.getByLabel('Category name').fill('  Studio   Workspace  ');
  await dialog.getByRole('button', { name: 'Save category', exact: true }).click();

  await expect(page.getByTestId('admin-category-card')).toHaveCount(initialCount + 1);
  await expect(page.getByRole('heading', { name: 'Studio Workspace', exact: true })).toBeVisible();
  expect(state.lastPayload).toEqual({ name: 'Studio Workspace' });
  expect(state.categories.find((category) => category.id === newCategoryId)).toMatchObject({
    name: 'Studio Workspace',
    slug: 'studio-workspace',
  });

  await navigateWithinAdmin(page, '/admin/products/new');
  await expect(page.getByRole('option', { name: 'Studio Workspace' })).toHaveAttribute(
    'value',
    newCategoryId,
  );
});

test('duplicate category names show the backend conflict and preserve input', async ({ page }) => {
  const state = await openCategories(page);
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a category' });
  await dialog.getByLabel('Category name').fill('  cHaIrS ');
  await dialog.getByRole('button', { name: 'Save category', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('already exists');
  await expect(dialog.getByLabel('Category name')).toHaveValue('  cHaIrS ');
  expect(state.categories.some((category) => category.name === '  cHaIrS ')).toBe(false);
});

test('slug conflicts returned by the backend preserve the proposed category name', async ({
  page,
}) => {
  const state = await openCategories(page, {
    categories: [
      {
        id: '507f1f77bcf86cd799439089',
        name: 'Home Decor!',
        slug: 'home-decor',
      },
    ],
  });
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a category' });
  await dialog.getByLabel('Category name').fill('Home Decor');
  await dialog.getByRole('button', { name: 'Save category', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('already exists');
  await expect(dialog.getByLabel('Category name')).toHaveValue('Home Decor');
  expect(state.categories).toHaveLength(1);
});

test('rename preserves category ID and sends only supported fields', async ({ page }) => {
  const state = await openCategories(page);
  const category = state.categories.find((item) => item.slug === 'chairs');
  await page.getByRole('button', { name: `Edit category ${category.name}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit category' });
  await dialog.getByLabel('Category name').fill('Accent Seating');
  await dialog.getByRole('button', { name: 'Save category', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Accent Seating', exact: true })).toBeVisible();
  expect(state.lastPayload).toEqual({ name: 'Accent Seating' });
  expect(state.categories.find((item) => item.id === category.id)).toMatchObject({
    id: category.id,
    slug: 'accent-seating',
  });
});

test('delete confirmation succeeds for unused categories and refreshes the list', async ({
  page,
}) => {
  const state = await openCategories(page);
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.getByLabel('Category name').fill('Unused category');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  const card = page.getByTestId('admin-category-card').filter({ hasText: 'Unused category' });
  await card.getByRole('button', { name: 'Delete category Unused category' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this category?' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Delete category Unused category' }).click();
  await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();

  await expect(card).toHaveCount(0);
  expect(state.categories.some((item) => item.name === 'Unused category')).toBe(false);
});

test('category referenced by an inactive product stays undeleted with a clear explanation', async ({
  page,
}) => {
  const state = await openCategories(page);
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.getByLabel('Category name').fill('Archive Furniture');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  const category = state.categories.find((item) => item.slug === 'archive-furniture');
  state.products.push({
    id: '507f1f77bcf86cd799439088',
    category: { ...category },
    isActive: false,
  });
  const card = page.getByTestId('admin-category-card').filter({ hasText: category.name });
  await expect(card).toContainText('0 active products');
  await card.getByRole('button', { name: `Delete category ${category.name}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this category?' });
  await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('includes inactive products');
  await expect(card).toBeVisible();
  expect(state.categories.some((item) => item.id === category.id)).toBe(true);
});

test('expired admin token during category write clears auth and returns to login', async ({
  page,
}) => {
  await openCategories(page, { unauthorized: true });
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a category' });
  await dialog.getByLabel('Category name').fill('New category');
  await dialog.getByRole('button', { name: 'Save category', exact: true }).click();

  await expect(page).toHaveURL('/admin/login');
});
