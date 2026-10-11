import { test, expect } from '@playwright/test';
import { apiProducts, mockShopApi } from './shopApiFixture';

const fixture = {
  ...apiProducts[0], name: 'Premium Wooden Sofa', description: 'A solid wood sofa from the live catalog.',
  material: 'Sheesham wood', color: 'Walnut brown', dimensions: { width: 210, length: 88, height: 82 },
  wood: undefined, colorHex: undefined,
  images: Array.from({ length: 5 }, (_, index) => ({ url: `https://res.cloudinary.com/fixture/image/upload/sofa-${index}.webp`, publicId: `fixture-${index}` })),
  tags: ['wooden', 'living room'],
};

async function mockDetails(page, overrides = {}) {
  const state = { product: fixture, status: 200, networkError: false, calls: [], ...overrides };
  await mockShopApi(page);
  await page.route('https://res.cloudinary.com/fixture/**', (route) => route.fulfill({ path: 'public/images/sofa.webp', contentType: 'image/webp' }));
  await page.route(/\/api\/products\/[a-f\d]{24}(\?|$)/i, async (route) => {
    state.calls.push(route.request().url());
    expect(route.request().headers().authorization).toBeUndefined();
    if (state.networkError) return route.abort('failed');
    return route.fulfill({ status: state.status, headers: { 'access-control-allow-origin': '*' },
      json: state.status === 200 ? { product: state.product } : { message: 'Product unavailable.' } });
  });
  return state;
}

test('Real Shop product link displays API details and first Cloudinary image without JWT', async ({ page }) => {
  await mockDetails(page);
  await page.goto('/shop');
  await page.getByTestId('product-card').first().getByRole('link').click();
  await expect(page).toHaveURL(`/products/${fixture.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.name);
  await expect(page.getByText(fixture.description, { exact: true })).toBeVisible();
  await expect(page.getByText(fixture.material, { exact: true })).toBeVisible();
  await expect(page.getByText(fixture.color, { exact: true })).toBeVisible();
  await expect(page.locator('main p.text-2xl')).toHaveText(new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(fixture.price));
  await expect(page.locator('main a.eyebrow')).toHaveAttribute('href', `/shop?category=${fixture.category.slug}`);
  await expect(page.getByText('210 × 88 × 82 cm', { exact: true })).toBeVisible();
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('src', fixture.images[0].url);
  await expect(page.getByText('Illustrative price', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'wooden', exact: true })).toHaveAttribute('href', '/shop?q=wooden');
});

for (const width of [320, 393, 768, 1440]) {
  test(`All five gallery images switch with thumbnails and arrows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockDetails(page);
    await page.goto(`/products/${fixture.id}`);
    await page.getByRole('button', { name: 'Show image 5', exact: true }).click();
    await expect(page.getByTestId('main-product-image')).toHaveAttribute('src', fixture.images[4].url);
    await page.getByRole('button', { name: 'Next product image' }).click();
    await expect(page.getByTestId('main-product-image')).toHaveAttribute('src', fixture.images[0].url);
    await page.getByRole('button', { name: 'Previous product image' }).click();
    await expect(page.getByRole('button', { name: 'Show image 5', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Missing images, category and optional specifications have safe fallbacks', async ({ page }) => {
  await mockDetails(page, { product: { ...fixture, images: [], category: null, dimensions: {}, material: '', color: '' } });
  await page.goto(`/products/${fixture.id}`);
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('src', '/images/living-room.webp');
  await page.getByRole('button', { name: 'Next product image' }).click();
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('src', '/images/living-room.webp');
  await expect(page.getByText('Not specified', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Dimensions (W × D × H)', { exact: true })).toHaveCount(0);
});

test('Invalid and missing IDs show not-found, with no request for malformed IDs', async ({ page }) => {
  const state = await mockDetails(page, { status: 404 });
  await page.goto('/products/not-a-product-id');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('comfortable');
  expect(state.calls).toHaveLength(0);
  await page.goto(`/products/${fixture.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('comfortable');
  expect(new Set(state.calls).size).toBe(1);
});

for (const failure of ['networkError', 'serverError']) {
  test(`${failure} displays retry rather than 404`, async ({ page }) => {
    const state = await mockDetails(page, failure === 'networkError' ? { networkError: true } : { status: 500 });
    await page.goto(`/products/${fixture.id}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unable to load this piece.');
    state.networkError = false; state.status = 200;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.name);
  });
}

test('Loading is explicit and leaving the page cancels a delayed response', async ({ page }) => {
  await mockDetails(page);
  let release, started, finished;
  const gate = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { started = resolve; });
  const done = new Promise((resolve) => { finished = resolve; });
  await page.route(/\/api\/products\/[a-f\d]{24}$/i, async (route) => {
    started(); await gate;
    await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { product: fixture } }).catch(() => {});
    finished();
  });
  await page.goto(`/products/${fixture.id}`);
  await ready;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loading furniture…');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Shop', exact: true }).click();
  release(); await done;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A piece for every story.');
});

test('Related navigation resets gallery; related API errors do not hide main details', async ({ page }) => {
  const state = await mockDetails(page);
  await page.goto(`/products/${fixture.id}`);
  await page.getByRole('button', { name: 'Show image 3', exact: true }).click();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  const nextId = await page.getByTestId('product-card').first().getByRole('link').getAttribute('href');
  state.product = { ...fixture, id: nextId.split('/').pop(), name: 'Second product' };
  await page.getByTestId('product-card').first().getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Second product');
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('src', fixture.images[0].url);
  await page.route(/\/api\/products\?/, (route) => route.abort('failed'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Second product');
  await expect(page.getByText(/Related furniture is unavailable/)).toBeVisible();
});
