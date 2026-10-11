import { test, expect } from '@playwright/test';
import { apiProducts, mockShopApi } from './shopApiFixture';

test('Shop maps live categories, first Cloudinary image and missing-image placeholder without JWT', async ({
  page,
}) => {
  const category = { id: 'a'.repeat(24), slug: 'outdoor', name: 'Outdoor furniture' };
  const cloudImage = 'https://res.cloudinary.com/fixture/image/upload/main.webp';
  await page.route(cloudImage, (route) =>
    route.fulfill({ path: 'public/images/chair.webp', contentType: 'image/webp' }),
  );
  await mockShopApi(page, {
    categories: [category],
    products: [
      {
        ...apiProducts[0],
        name: 'Backend chair',
        category,
        images: [{ url: cloudImage }, { url: '/images/bed.webp' }],
      },
      { ...apiProducts[1], name: 'No image chair', category: null, images: [] },
    ],
  });
  await page.goto('/shop');
  await expect(page.getByTestId('product-card')).toHaveCount(2);
  const first = page.getByTestId('product-card').filter({ hasText: 'Backend chair' });
  await expect(first).toContainText(category.name);
  await expect(first.locator('img')).toHaveAttribute('src', cloudImage);
  await expect(first.getByRole('link')).toHaveAttribute('href', `/products/${apiProducts[0].id}`);
  await expect(
    page.getByTestId('product-card').filter({ hasText: 'No image chair' }).locator('img'),
  ).toHaveAttribute('src', '/images/living-room.webp');
  await expect(
    page.getByTestId('product-card').filter({ hasText: 'No image chair' }),
  ).toContainText('Furniture');
  await expect(page.getByText('sample price', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: category.name, exact: true })).toBeVisible();
});

test('Search/category/price/sort use supported backend parameters and clear correctly', async ({
  page,
}) => {
  const state = await mockShopApi(page);
  await page.goto('/shop?category=sofas&q=green&price=20000-50000&sort=price-asc');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  const request = state.requests.find((url) => url.pathname.endsWith('/products'));
  expect(Object.fromEntries(request.searchParams)).toEqual({
    search: 'green',
    category: 'sofas',
    minPrice: '20000',
    maxPrice: '50000',
    sort: 'price_asc',
    page: '1',
    limit: '100',
  });
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(12);
});

test('All backend pages are consumed before local material filtering and A–Z sort', async ({
  page,
}) => {
  const state = await mockShopApi(page, { pageSize: 2 });
  await page.goto('/shop?material=Wood&sort=name');
  const expected = apiProducts
    .filter((product) => product.material === 'Wood')
    .sort((a, b) => a.name.localeCompare(b.name));
  await expect(page.getByTestId('product-card')).toHaveCount(expected.length);
  await expect(page.getByTestId('product-card').first()).toContainText(expected[0].name);
  expect(
    state.requests
      .filter((url) => url.pathname.endsWith('/products'))
      .map((url) => url.searchParams.get('page')),
  ).toEqual(['1', '2', '3', '4', '5', '6']);
});

test('Empty database and unknown category have an honest empty state', async ({ page }) => {
  await mockShopApi(page, { categories: [], products: [] });
  await page.goto('/shop?category=unknown');
  await expect(page.getByText('A little room to try again.')).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore Sofas', exact: true })).toHaveCount(0);
});

for (const failure of ['failProducts', 'failCategories']) {
  test(`${failure} shows a retryable error without falling back to mock furniture`, async ({
    page,
  }) => {
    const state = await mockShopApi(page, { [failure]: true });
    await page.goto('/shop');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(0);
    state[failure] = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('product-card')).toHaveCount(12);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('Delayed old search cannot overwrite a newer response; loading is visible', async ({
  page,
}) => {
  await mockShopApi(page);
  let started, release, completed;
  const pending = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const settled = new Promise((resolve) => {
    completed = resolve;
  });
  await page.route(/\/api\/products\?.*search=old/, async (route) => {
    started();
    await gate;
    await route
      .fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          products: [{ ...apiProducts[0], name: 'Stale result' }],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        },
      })
      .catch(() => {});
    completed();
  });
  await page.goto('/shop?q=old');
  await pending;
  await expect(page.getByText('Loading furniture…').first()).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Search product names, descriptions, or tags' })
    .fill('green');
  try {
    await expect(page.getByTestId('product-card')).toHaveCount(3);
  } finally {
    release();
  }
  await settled;
  await expect(page.getByText('Stale result', { exact: true })).toHaveCount(0);
});

test('Network failures show a clean error', async ({ page }) => {
  await mockShopApi(page);
  await page.route(/\/api\/products\?/, (route) => route.abort('failed'));
  await page.goto('/shop');
  await expect(page.getByRole('alert')).toContainText('Unable to reach the server.');
  await expect(page.getByTestId('product-card')).toHaveCount(0);
});

test('Failure on a later page does not display incomplete results as a full collection', async ({
  page,
}) => {
  await mockShopApi(page, { pageSize: 2 });
  await page.route(/\/api\/products\?.*page=2/, (route) =>
    route.fulfill({
      status: 500,
      headers: { 'access-control-allow-origin': '*' },
      json: { message: 'Error' },
    }),
  );
  await page.goto('/shop');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(0);
});

test('Global Search and Homepage load live catalog products without JWT', async ({ page }) => {
  const state = await mockShopApi(page);
  await page.goto('/search?q=oak');
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  const searchRequest = state.requests.find(
    (request) => request.pathname.endsWith('/products') && request.searchParams.has('search'),
  );
  expect(Object.fromEntries(searchRequest.searchParams)).toEqual({
    search: 'oak',
    sort: 'newest',
    page: '1',
    limit: '100',
  });
  await expect(page.getByTestId('product-card').first().getByRole('link')).toHaveAttribute(
    'href',
    `/products/${apiProducts.find((product) => product.name === 'Elm Accent Chair').id}`,
  );

  await page.goto('/');
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  expect(state.requests.some((request) => request.searchParams.get('limit') === '4')).toBe(true);
});
