import { expect, test } from '@playwright/test';
import { apiProducts, mockShopApi } from './shopApiFixture';

test('Homepage displays newest live products with category, Cloudinary image, and MongoDB links', async ({
  page,
}) => {
  const cloudImage = 'https://res.cloudinary.com/fixture/image/upload/home-main.webp';
  const newest = {
    ...apiProducts[0],
    id: 'a'.repeat(24),
    name: 'Newest live console',
    price: 47900,
    category: { id: 'b'.repeat(24), slug: 'entryway', name: 'Entryway furniture' },
    images: [{ url: cloudImage }, { url: '/images/bed.webp' }],
  };
  const noImage = {
    ...apiProducts[1],
    id: 'c'.repeat(24),
    name: 'Live chair awaiting images',
    category: { id: 'd'.repeat(24), slug: 'chairs', name: 'Chairs' },
    images: [],
  };
  const state = await mockShopApi(page, { products: [noImage, newest] });

  await page.goto('/');

  const cards = page.getByTestId('product-card');
  await expect(cards).toHaveCount(2);
  const newestCard = cards.filter({ hasText: newest.name });
  await expect(newestCard).toContainText('Entryway furniture');
  await expect(newestCard.getByTestId('product-price')).toContainText('47,900');
  await expect(newestCard.locator('img')).toHaveAttribute('src', cloudImage);
  await expect(newestCard.getByRole('link')).toHaveAttribute('href', `/products/${newest.id}`);
  await expect(cards.filter({ hasText: noImage.name }).locator('img')).toHaveAttribute(
    'src',
    '/images/living-room.webp',
  );
  await expect(page.getByText('sample price', { exact: true })).toHaveCount(0);
  expect(Object.fromEntries(state.requests[0].searchParams)).toEqual({
    sort: 'newest',
    page: '1',
    limit: '4',
  });
});

test('Homepage shows loading while the public product request is pending', async ({ page }) => {
  await mockShopApi(page);
  let release;
  let started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/products\?/, async (route) => {
    started();
    await gate;
    await route.fulfill({
      json: {
        products: [apiProducts[0]],
        pagination: { total: 1, page: 1, limit: 4, totalPages: 1 },
      },
    });
  });

  await page.goto('/');
  await waiting;
  await expect(page.getByRole('status')).toContainText('Loading furniture…');
  release();
  await expect(page.getByTestId('product-card')).toHaveCount(1);
});

test('Homepage errors are retryable and never fall back to sample products', async ({ page }) => {
  const state = await mockShopApi(page, { failProducts: true });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load the collection.');
  await expect(page.getByTestId('product-card')).toHaveCount(0);

  state.failProducts = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(4);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Homepage does not show products when the active catalog is empty', async ({ page }) => {
  await mockShopApi(page, { products: [] });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Our furniture collection is taking shape.');
  await expect(page.getByTestId('product-card')).toHaveCount(0);
});

test('A cancelled Homepage request cannot replace products from the latest visit', async ({
  page,
}) => {
  await mockShopApi(page);
  let release;
  let started;
  let requests = 0;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const latest = { ...apiProducts[0], id: 'e'.repeat(24), name: 'Latest home response' };
  await page.route(/\/api\/products\?/, async (route) => {
    requests += 1;
    if (requests === 1) {
      started();
      await gate;
      await route
        .fulfill({
          json: {
            products: [{ ...apiProducts[0], name: 'Cancelled stale response' }],
            pagination: { total: 1, page: 1, limit: 4, totalPages: 1 },
          },
        })
        .catch(() => {});
      return;
    }
    await route.fulfill({
      json: {
        products: [latest],
        pagination: { total: 1, page: 1, limit: 4, totalPages: 1 },
      },
    });
  });

  await page.goto('/');
  await waiting;
  await page.getByRole('link', { name: 'Shop', exact: true }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await page.locator('header').getByRole('link', { name: 'Home', exact: true }).click();
  const cards = page.getByTestId('product-card');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText(latest.name);
  release();
  await expect(cards).not.toContainText('Cancelled stale response');
});
