import { expect, test } from '@playwright/test';
import { navigateWithinAdmin, signInToAdmin } from './adminAuthFixture';
import { apiCategories, apiProducts } from './shopApiFixture';

async function openDashboard(page, options = {}) {
  const state = {
    activeProductCount: 14,
    categoryCounts: {
      [apiCategories[0].slug]: 8,
      [apiCategories[1].slug]: 6,
      [apiCategories[2].slug]: 0,
    },
    requests: [],
    failProductRequests: false,
    ...options,
  };
  await page.route('**/api/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: state.categories ?? apiCategories.slice(0, 3) }),
    }),
  );
  await page.route('**/api/products*', async (route) => {
    const url = new URL(route.request().url());
    state.requests.push({
      category: url.searchParams.get('category'),
      limit: Number(url.searchParams.get('limit')),
      page: Number(url.searchParams.get('page')),
    });
    if (state.failProductRequests) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service unavailable.' }),
      });
      return;
    }
    const category = url.searchParams.get('category');
    const products =
      category || state.activeProductCount === 0
        ? []
        : apiProducts.slice(0, 5).map((product) => ({ ...product, isActive: true }));
    const total = category ? (state.categoryCounts[category] ?? 0) : state.activeProductCount;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        products,
        pagination: {
          total,
          page: 1,
          limit: category ? 1 : 5,
          totalPages: Math.ceil(total / (category ? 1 : 5)),
        },
      }),
    });
  });
  await signInToAdmin(page);
  await expect(page).toHaveURL('/admin/dashboard');
  return state;
}

test('dashboard uses active product metadata, category metadata, and recent active products', async ({
  page,
}) => {
  const state = await openDashboard(page);
  await expect(page.getByTestId('dashboard-stat-active-products')).toContainText('14');
  await expect(page.getByTestId('dashboard-stat-categories')).toContainText('3');
  await expect(page.getByTestId('dashboard-stat-categories-with-products')).toContainText('2');
  await expect(page.getByText('Active products by category')).toBeVisible();
  await expect(page.getByText('8 pieces', { exact: true })).toBeVisible();
  await expect(page.getByText('6 pieces', { exact: true })).toBeVisible();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(5);
  expect(state.requests).toContainEqual({ category: null, limit: 5, page: 1 });
  expect(
    new Set(state.requests.filter((request) => request.category).map((item) => item.category)),
  ).toEqual(new Set(apiCategories.slice(0, 3).map((category) => category.slug)));
  expect(state.requests.filter((request) => request.limit === 1).length).toBeGreaterThanOrEqual(3);

  state.activeProductCount = 15;
  await navigateWithinAdmin(page, '/admin/categories');
  await navigateWithinAdmin(page, '/admin/dashboard');
  await expect(page.getByTestId('dashboard-stat-active-products')).toContainText('15');
});

test('dashboard presents empty catalog and category states', async ({ page }) => {
  await openDashboard(page, {
    activeProductCount: 0,
    categories: [],
    categoryCounts: {},
  });
  await expect(page.getByTestId('dashboard-stat-active-products')).toContainText('0');
  await expect(page.getByTestId('dashboard-stat-categories')).toContainText('0');
  await expect(page.getByText('Add a category to begin organising your collection.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your collection starts here.' })).toBeVisible();
  await expect(page.getByTestId('admin-product-row')).toHaveCount(0);
});

test('dashboard shows a retry state when catalog data cannot be loaded', async ({ page }) => {
  const state = await openDashboard(page, { failProductRequests: true });
  await expect(page.getByRole('alert')).toContainText('server could not complete');
  await expect(page.getByTestId('dashboard-stat-categories')).toContainText('—');
  await expect(page.getByText('Recent products are unavailable right now.')).toBeVisible();
  state.failProductRequests = false;
  await page.getByRole('button', { name: 'Retry loading overview' }).click();
  await expect(page.getByTestId('dashboard-stat-active-products')).toContainText('14');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
