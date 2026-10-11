import { expect, test } from '@playwright/test';
import { mockAdminAuth, navigateWithinAdmin, testAdmin } from './adminAuthFixture';

test('admin login validates backend credentials and verifies role with /me', async ({ page }) => {
  let loginAttempts = 0;
  const meHeaders = [];
  await page.route('**/api/admin/login', async (route) => {
    loginAttempts += 1;
    if (loginAttempts === 1) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-admin-token', admin: testAdmin }),
    });
  });
  await page.route('**/api/admin/me', async (route) => {
    meHeaders.push(route.request().headers().authorization);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ admin: testAdmin }),
    });
  });

  await page.goto('/admin/login');
  await page.getByLabel('Admin email').fill(testAdmin.email);
  await page.locator('#login-password').fill('wrong-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
  await expect(page).toHaveURL('/admin/login');

  await page.locator('#login-password').fill('correct-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/admin/dashboard');
  expect(meHeaders).toContain('Bearer mock-admin-token');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('admin routes redirect to login when no in-memory session exists', async ({ page }) => {
  await mockAdminAuth(page);
  await page.goto('/admin/products');
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('login rejects a user whose backend profile does not have an admin role', async ({ page }) => {
  await page.route('**/api/admin/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-token', admin: { ...testAdmin, role: 'editor' } }),
    }),
  );
  await page.route('**/api/admin/me', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'You do not have permission to access this resource.' }),
    }),
  );

  await page.goto('/admin/login');
  await page.getByLabel('Admin email').fill(testAdmin.email);
  await page.locator('#login-password').fill('mock-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'This account is not authorized to access the admin dashboard.',
  );
  await expect(page).toHaveURL('/admin/login');
});

test('logout clears the in-memory session and invalid JWT verification redirects to login', async ({
  page,
}) => {
  let rejectCurrentAdmin = false;
  await page.route('**/api/admin/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-admin-token', admin: testAdmin }),
    }),
  );
  await page.route('**/api/admin/me', (route) => {
    const unauthorized = rejectCurrentAdmin;
    return route.fulfill({
      status: unauthorized ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        unauthorized
          ? { message: 'Invalid or expired authentication token.' }
          : { admin: testAdmin },
      ),
    });
  });

  await page.goto('/admin/login');
  await page.getByLabel('Admin email').fill(testAdmin.email);
  await page.locator('#login-password').fill('mock-admin-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/admin/dashboard');

  await page.getByLabel('Admin profile options').click();
  await page.locator('header').getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL('/admin/login');
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL('/admin/login');

  await page.getByLabel('Admin email').fill(testAdmin.email);
  await page.locator('#login-password').fill('mock-admin-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/admin/dashboard');

  rejectCurrentAdmin = true;
  await navigateWithinAdmin(page, '/admin/products');
  await expect(page).toHaveURL('/admin/login');
});
