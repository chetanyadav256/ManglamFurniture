import { test, expect } from '@playwright/test';
import { mockShopApi } from './shopApiFixture';

test.beforeEach(async ({ page }) => {
  await mockShopApi(page);
});

const widths = [320, 337, 360, 377, 393, 412, 531, 639, 640, 711, 768, 913, 1024, 1440];
const routes = ['/', '/shop', '/products/olive-lounge-sofa', '/about', '/contact', '/search?q=oak'];

async function ready(page) {
  const url = new URL(page.url());
  if (url.pathname === '/shop')
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  if (url.pathname === '/search') {
    if ((url.searchParams.get('q') || '').length > 100)
      await expect(page.getByRole('alert')).toBeVisible();
    else await expect(page.getByTestId('product-card').first()).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) => {
        image.loading = 'eager';
        return image.decode().catch(() => {});
      }),
    );
  });
}

for (const width of widths) {
  test(`public content fits at ${width}px including card text and header hit areas`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of routes) {
      await page.goto(route);
      await ready(page);
      const problems = await page.evaluate(() => {
        const defects = [];
        const elements = document.querySelectorAll(
          'header a, header button, main h1, main h2, main h3, main p, main article, main a[aria-label^="Explore"]',
        );
        for (const element of elements) {
          if (!element.getClientRects().length || element.closest('dialog:not([open])')) continue;
          const rect = element.getBoundingClientRect();
          if (rect.left < -1 || rect.right > innerWidth + 1)
            defects.push(
              `${element.tagName}: ${element.textContent || element.getAttribute('aria-label')}`,
            );
          if (
            element.matches('h1,h2,h3,p') &&
            element.clientWidth &&
            element.scrollWidth > element.clientWidth + 1
          )
            defects.push(`Text clipped: ${element.textContent}`);
        }
        if (document.documentElement.scrollWidth > innerWidth) defects.push('Page overflow');
        const controls = [...document.querySelectorAll('header a,header button,header summary')]
          .filter((el) => el.getClientRects().length)
          .map((el) => el.getBoundingClientRect());
        if (
          controls.some((a, i) =>
            controls
              .slice(i + 1)
              .some(
                (b) =>
                  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
              ),
          )
        )
          defects.push('Header overlap');
        return defects;
      });
      expect(problems, route).toEqual([]);
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
    }
    expect(errors).toEqual([]);
  });
}

test('320px navbar fits before webfonts load and mobile menu/search still work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route('**/fonts/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  const bounds = await menu.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await menu.click();
  await page.getByRole('dialog').getByRole('link', { name: 'Shop', exact: true }).click();
  await expect(page).toHaveURL('/shop');
  await page.getByRole('button', { name: 'Search furniture', exact: true }).click();
  const searchDialog = page.getByRole('dialog', { name: 'Find your next favourite.' });
  await searchDialog.getByLabel('Search product names, descriptions, or tags').fill('oak');
  await searchDialog.getByRole('button', { name: 'Submit search', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(3);
});

for (const width of [320, 393, 711]) {
  test(`long labels and search text wrap without changing catalog data at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const text = 'ContemporaryFurnitureCollectionDesign'.repeat(3);
    await page.goto(`/search?q=${encodeURIComponent(text)}`);
    await ready(page);
    const token = page
      .getByRole('button', { name: `Remove search: ${text}`, exact: true })
      .locator('span');
    expect(await token.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.goto('/shop');
    await ready(page);
    // DOM-only stress fixtures; application data and source remain unchanged.
    const category = page.locator('[aria-label="Browse furniture categories"] h3').first();
    const fits = await category.evaluate((el) => {
      el.textContent = 'ContemporaryFurnitureCollection';
      const box = el.getBoundingClientRect(),
        parent = el.parentElement.getBoundingClientRect();
      return (
        box.left >= parent.left - 1 &&
        box.right <= parent.right + 1 &&
        el.scrollWidth <= el.clientWidth + 1
      );
    });
    expect(fits).toBe(true);
    const productName = page.getByTestId('product-card').first().locator('h3');
    expect(
      await productName.evaluate((el, value) => {
        el.textContent = value;
        return el.scrollWidth <= el.clientWidth + 1;
      }, text),
    ).toBe(true);
    await page.goto('/products/olive-lounge-sofa');
    await ready(page);
    await page
      .locator('main .chip')
      .first()
      .evaluate((el) => {
        el.firstChild.textContent = 'm'.repeat(40);
      });
    await page.locator('[aria-current="page"]').evaluate((el, value) => {
      el.textContent = value;
    }, text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
