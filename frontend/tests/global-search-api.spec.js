import { expect, test } from '@playwright/test';
import { apiProducts, mockShopApi } from './shopApiFixture';

test('Global Search displays MongoDB results, Cloudinary image, category, price, and ID route', async ({
  page,
}) => {
  const cloudImage = 'https://res.cloudinary.com/fixture/image/upload/search-chair.webp';
  const product = {
    ...apiProducts[0],
    id: 'a'.repeat(24),
    name: 'Backend search chair',
    price: 32900,
    description: 'A locally crafted reading chair.',
    tags: ['reading'],
    category: { id: 'b'.repeat(24), slug: 'chairs', name: 'Reading chairs' },
    images: [{ url: cloudImage }, { url: '/images/bed.webp' }],
  };
  const state = await mockShopApi(page, { products: [product] });

  await page.goto('/');
  await page.getByRole('button', { name: 'Search furniture' }).click();
  const dialog = page.getByRole('dialog', { name: 'Find your next favourite.' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Search product names, descriptions, or tags').fill('reading chair');
  await dialog.getByRole('button', { name: 'Submit search' }).click();

  await expect(page).toHaveURL(/\/search\?q=reading%20chair$/);
  const card = page.getByTestId('product-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Backend search chair');
  await expect(card).toContainText('Reading chairs');
  await expect(card.getByTestId('product-price')).toContainText('32,900');
  await expect(card.locator('img')).toHaveAttribute('src', cloudImage);
  await expect(card.getByRole('link')).toHaveAttribute('href', `/products/${product.id}`);

  const searchRequest = state.requests.find(
    (request) => request.pathname.endsWith('/products') && request.searchParams.has('search'),
  );
  expect(Object.fromEntries(searchRequest.searchParams)).toEqual({
    search: 'reading chair',
    sort: 'newest',
    page: '1',
    limit: '100',
  });
});

test('Category selection filters separately from backend text search', async ({ page }) => {
  const state = await mockShopApi(page);
  await page.goto('/search?q=oak');
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Chairs', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Elm Accent Chair');
  expect(
    state.requests.some(
      (request) =>
        request.pathname.endsWith('/products') &&
        request.searchParams.get('search') === 'oak' &&
        request.searchParams.get('category') === 'chairs',
    ),
  ).toBe(true);
});

test('No matching search results show the existing empty state, not sample products', async ({
  page,
}) => {
  await mockShopApi(page);
  await page.goto('/search?q=no-live-match');
  await expect(page.getByRole('heading', { name: 'A little room to try again.' })).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(0);
});

test('An empty query browses live active products without sending an empty search parameter', async ({
  page,
}) => {
  const product = { ...apiProducts[0], id: 'c'.repeat(24), name: 'Only live product' };
  const state = await mockShopApi(page, { products: [product] });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search furniture' }).click();
  await page
    .getByRole('dialog', { name: 'Find your next favourite.' })
    .getByRole('button', { name: 'Submit search' })
    .click();

  await expect(page).toHaveURL('/search');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Only live product');
  const productRequest = state.requests.find((request) => request.pathname.endsWith('/products'));
  expect(productRequest.searchParams.has('search')).toBe(false);
});

test('Products without uploaded images use the existing fallback', async ({ page }) => {
  const product = {
    ...apiProducts[0],
    id: 'd'.repeat(24),
    name: 'Olive image pending product',
    images: [],
  };
  await mockShopApi(page, { products: [product] });
  await page.goto('/search?q=olive');
  await expect(page.getByTestId('product-card').locator('img')).toHaveAttribute(
    'src',
    '/images/living-room.webp',
  );
});

test('Search network errors can be retried without showing sample results', async ({ page }) => {
  await mockShopApi(page);
  const failNetwork = (route) => route.abort('failed');
  await page.route(/\/api\/products\?/, failNetwork);
  await page.goto('/search?q=oak');
  await expect(page.getByRole('alert')).toContainText('Unable to reach the server.');
  await expect(page.getByTestId('product-card')).toHaveCount(0);

  await page.unroute(/\/api\/products\?/, failNetwork);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Rapid query changes do not allow an older response to replace current results', async ({
  page,
}) => {
  const state = await mockShopApi(page);
  let release;
  let started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/products\?.*search=old-query/, async (route) => {
    started();
    await gate;
    await route
      .fulfill({
        json: {
          products: [{ ...apiProducts[0], name: 'Stale old-query furniture' }],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        },
      })
      .catch(() => {});
  });
  const current = {
    ...apiProducts[0],
    id: 'e'.repeat(24),
    name: 'Current new-query furniture',
    description: 'new-query match',
    tags: [],
  };
  state.products = [current];

  await page.goto('/search?q=old-query');
  await waiting;
  await page
    .getByRole('searchbox', { name: 'Search product names, descriptions, or tags' })
    .fill('new-query');
  try {
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByTestId('product-card')).toContainText(current.name);
  } finally {
    release();
  }
  await expect(page.getByText('Stale old-query furniture', { exact: true })).toHaveCount(0);
});

test('Search dialog retains keyboard close behavior and works on mobile', async ({ page }) => {
  const state = await mockShopApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search furniture' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Find your next favourite.' });
  const input = dialog.getByLabel('Search product names, descriptions, or tags');
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByLabel('Search product names, descriptions, or tags').fill('elm');
  await dialog.getByRole('button', { name: 'Submit search' }).click();
  await expect(page).toHaveURL(/\/search\?q=elm$/);
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  expect(state.requests.some((request) => request.searchParams.get('search') === 'elm')).toBe(true);
});
