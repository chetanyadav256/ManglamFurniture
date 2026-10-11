export const testAdmin = {
  id: '507f1f77bcf86cd799439011',
  name: 'Catalog Administrator',
  email: 'admin@example.test',
  role: 'admin',
};

export async function mockAdminAuth(page) {
  await page.route('**/api/admin/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-admin-token', admin: testAdmin }),
    }),
  );
  await page.route('**/api/admin/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ admin: testAdmin }),
    }),
  );
}

export async function signInToAdmin(page) {
  await mockAdminAuth(page);
  await page.goto('/admin/login');
  await page.getByLabel('Admin email').fill(testAdmin.email);
  await page.locator('#login-password').fill('mock-admin-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL('**/admin/dashboard');
}

export async function navigateWithinAdmin(page, path) {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL(`**${path}`);
}
