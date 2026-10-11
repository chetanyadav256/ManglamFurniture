import { test, expect } from '@playwright/test';

test('desktop category navigation, filtering, and history work', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Shop categories', { exact: true }).click();
  await page.locator('header').getByRole('link', { name: 'Sofas', exact: true }).click();
  await expect(page).toHaveURL(/category=sofas/);
  await expect(page.getByTestId('product-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Beds', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(2);
  await expect(page.getByTestId('product-card').first()).toContainText('Bed');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Sofas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByTestId('product-card')).toHaveCount(2);
});

test('search finds names, categories, and tags, with recoverable empty state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search furniture', exact: true }).click();
  await page.getByLabel('Search by name, category, or tag', { exact: true }).fill('oak');
  await page.getByRole('button', { name: 'Submit search', exact: true }).click();
  await expect(page).toHaveURL(/search\?q=oak/);
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Chairs', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Elm Accent Chair');
  const search = page.getByRole('searchbox', { name: 'Search products by name, category, or tag' });
  await search.fill('zzzz-no-match');
  await expect(page.getByRole('heading', { name: 'A little room to try again.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore all furniture', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(12);
  await search.fill('  OLIVE   LOUNGE  ');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await search.fill('storage');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Aria Wall Cabinet');
});

test('price/material filters combine, sort both directions, and reset', async ({ page }) => {
  await page.goto('/shop');
  await page.getByLabel('Sort products').selectOption('price-asc');
  await expect(page.getByTestId('product-card').first()).toContainText('Nook Side Table');
  await page.getByLabel('Sort products').selectOption('price-desc');
  await expect(page.getByTestId('product-card').first()).toContainText('Verdant Dining Set');
  await page.getByLabel('Sort products').selectOption('name');
  await expect(page.getByTestId('product-card').first()).toContainText('Aria Wall Cabinet');
  await page.getByLabel('Material', { exact: true }).first().selectOption('Wood');
  await page.getByLabel('Price range', { exact: true }).first().selectOption('under-20000');
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await page.reload();
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(12);
});

test('product gallery, tags, related pieces, and enquiry context work', async ({ page }) => {
  await page.goto('/products/olive-lounge-sofa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olive Lounge Sofa');
  await page.getByRole('button', { name: 'Show detail crop' }).click();
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('alt', /detail crop/);
  await page.getByRole('button', { name: 'Next product image' }).click();
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('alt', /texture crop/);
  await page.getByRole('link', { name: 'Enquire about this piece' }).click();
  await expect(page).toHaveURL(/contact\?product=olive-lounge-sofa/);
  await expect(page.getByRole('link', { name: 'Olive Lounge Sofa', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'green', exact: true }).click();
  await expect(page).toHaveURL(/search\?q=green/);
  await expect(page.getByTestId('product-card')).toHaveCount(2);
  await page.goto('/products/olive-lounge-sofa');
  await page.getByTestId('product-card').first().getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sienna Lounge Sofa');
  await expect(page.getByTestId('main-product-image')).toHaveAttribute('alt', /full view/);
});

test('mobile menu and filter dialog are functional and keyboard accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Open navigation' });
  await menuButton.click();
  const navigation = page.getByRole('dialog', { name: 'Make yourself at home.' });
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation).not.toBeVisible();
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await navigation.getByRole('link', { name: 'Shop', exact: true }).click();
  await expect(navigation).not.toBeVisible();
  await expect(page).toHaveURL(/\/shop$/);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Find your perfect piece.' });
  // URL-driven navigation commits asynchronously; assert the resulting state.
  await filters.getByLabel('Beds', { exact: true }).click();
  await expect(filters.getByLabel('Beds', { exact: true })).toBeChecked();
  await filters.getByLabel('Material', { exact: true }).selectOption('Wood');
  await filters.getByRole('button', { name: 'Show 1 piece', exact: true }).click();
  await expect(filters).not.toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Meadow Platform Bed');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('search traps keyboard focus and Escape restores its trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search furniture', exact: true });
  await trigger.click();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog[open]')))).toBe(
      true,
    );
  }
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('contact uses honest placeholders and unknown routes recover', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByText('Store address to be confirmed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open in Google Maps' })).toBeDisabled();
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
  for (const route of ['/does-not-exist', '/products/missing-product']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('comfortable');
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/');
  }
});

test('Shop supports tag-only search alongside category filters and sorting', async ({ page }) => {
  await page.goto('/shop');
  await page
    .getByRole('searchbox', { name: 'Search products by name, category, or tag' })
    .fill('reading corner');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Elm Accent Chair');
  await page.getByRole('button', { name: 'Chairs', exact: true }).click();
  await page.getByLabel('Sort products').selectOption('price-desc');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sofas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little room to try again.' })).toBeVisible();
});

test('navigation closes by button, backdrop, route, and when crossing the desktop breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  const menu = page.getByRole('dialog', { name: 'Make yourself at home.' });
  await trigger.click();
  await menu.getByRole('button', { name: 'Close navigation' }).click();
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(20, 300);
  await expect(menu).not.toBeVisible();
  await trigger.click();
  await menu.getByRole('link', { name: 'About', exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(page).toHaveURL('/about');
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(menu).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  const categories = page.getByLabel('Shop categories', { exact: true });
  await categories.click();
  await page.keyboard.press('Escape');
  await expect(categories).toBeFocused();
  await categories.click();
  await page.setViewportSize({ width: 768, height: 900 });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator('header details')).not.toHaveAttribute('open', '');
});

test('filter drawer releases scroll and focus when switching to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Find your perfect piece.' })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole('dialog', { name: 'Find your perfect piece.' })).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Filter products' })).toBeVisible();
});

for (const width of [360, 390, 393, 768, 1024, 1440]) {
  test(`all pages render without overflow, failed images, or runtime errors at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const routes = [
      '/',
      '/shop',
      '/products/olive-lounge-sofa',
      '/about',
      '/contact',
      '/search?q=oak',
      '/404',
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const header = page.locator('header');
      await expect(header.getByRole('link', { name: 'Manglam Furniture home' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Find our showroom' })).toBeVisible();
      await expect(header.getByRole('button', { name: 'Search furniture' })).toBeVisible();
      if (width >= 1024) {
        const nav = page.getByRole('navigation', { name: 'Main navigation' });
        await expect(nav).toBeVisible();
        for (const name of ['Home', 'Shop', 'About', 'Contact'])
          await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
        await expect(header.getByText('Location', { exact: true })).toBeVisible();
        await expect(header.getByText('Search', { exact: true })).toBeVisible();
        await expect(header.getByRole('button', { name: 'Open navigation' })).not.toBeVisible();
      } else {
        await expect(header.getByRole('button', { name: 'Open navigation' })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Main navigation' })).not.toBeVisible();
      }
      // Visible header hit areas must not overlap at the 1024px breakpoint or on phones.
      const overlaps = await header.locator('a, button, summary').evaluateAll((elements) => {
        const boxes = elements
          .filter((element) => element.getClientRects().length)
          .map((element) => ({
            label: element.textContent || element.getAttribute('aria-label'),
            rect: element.getBoundingClientRect(),
          }));
        return boxes.flatMap((a, index) =>
          boxes
            .slice(index + 1)
            .filter(
              (b) =>
                Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 &&
                Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1,
            )
            .map((b) => [a.label, b.label]),
        );
      });
      expect(overlaps, route).toEqual([]);
      await expect(
        page.getByRole('button', {
          name: /cart|wishlist|checkout|buy now|purchase|quantity|pay now/i,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: /cart|wishlist|checkout|buy now|purchase|payment/i }),
      ).toHaveCount(0);
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
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        route,
      ).toBe(true);
      const broken = await page
        .locator('img')
        .evaluateAll((images) =>
          images
            .filter((image) => !image.complete || !image.naturalWidth)
            .map((image) => image.src),
        );
      expect(broken, route).toEqual([]);
      if (route === '/') {
        const size = await page
          .locator('#home-hero-title')
          .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        expect(size).toBeLessThanOrEqual(width < 500 ? 42 : 64);
      }
      await page.screenshot({
        path: testInfo.outputPath(
          `${route === '/' ? 'home' : route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}
