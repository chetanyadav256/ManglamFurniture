import { test, expect } from '@playwright/test';
import { signInToAdmin, navigateWithinAdmin, testAdmin } from './adminAuthFixture';

async function openSettings(page) {
  // Keep unrelated dashboard reads isolated; authentication uses its own fixture.
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: {
        products: [],
        categories: [],
        pagination: { total: 0, page: 1, limit: 100, totalPages: 0 },
      },
    }),
  );
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/settings');
  await expect(page.getByLabel('Display name')).toHaveValue(testAdmin.name);
  await expect(
    page.getByText(/profile, and password settings use the connected backend/),
  ).toBeVisible();
  await expect(page.getByText(/preview-only/i)).toHaveCount(0);
}

test('Blank and excessively long display names are rejected before sending a request', async ({
  page,
}) => {
  await openSettings(page);
  const writes = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH') writes.push(request);
  });
  for (const name of ['   ', 'a'.repeat(81)]) {
    await page.getByLabel('Display name').evaluate((input) => input.removeAttribute('maxlength'));
    await page.getByLabel('Display name').fill(name);
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Name must contain');
    await expect(page.getByLabel('Display name')).toHaveValue(name);
  }
  expect(writes).toHaveLength(0);
});

for (const failure of [400, 500, 'network']) {
  test(`Failed save (${failure}) preserves the entered name and allows retry`, async ({ page }) => {
    await openSettings(page);
    await page.route('**/api/admin/me', (route) =>
      failure === 'network'
        ? route.abort('failed')
        : route.fulfill({ status: failure, json: { message: 'Unable to save profile.' } }),
    );
    await page.getByLabel('Display name').fill('Keep My Draft');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Display name')).toHaveValue('Keep My Draft');
    await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Admin profile options')).toContainText(testAdmin.name);
  });
}

for (const status of [401, 403]) {
  test(`A ${status} save clears the authenticated session`, async ({ page }) => {
    await openSettings(page);
    await page.route('**/api/admin/me', (route) =>
      route.fulfill({ status, json: { message: 'Unauthorized' } }),
    );
    await page.getByLabel('Display name').fill('New Name');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page).toHaveURL('/admin/login');
  });
}

test('Pending saves show loading and prevent duplicate submissions', async ({ page }) => {
  await openSettings(page);
  let release,
    started,
    writes = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  await page.route('**/api/admin/me', async (route) => {
    writes++;
    started();
    await gate;
    await route.fulfill({ json: { admin: { ...testAdmin, name: 'Saved Name' } } });
  });
  await page.getByLabel('Display name').fill('Saved Name');
  await page.locator('#profile-name').evaluate((input) => {
    input.form.requestSubmit();
    input.form.requestSubmit();
  });
  await waiting;
  try {
    await expect(page.getByRole('button', { name: /Saving/ })).toBeDisabled();
    await expect(page.getByLabel('Display name')).toBeDisabled();
    await page.locator('#profile-name').evaluate((input) => input.form.requestSubmit());
  } finally {
    release();
  }
  await expect(page.getByLabel('Display name')).toBeEnabled();
  await expect(page.getByLabel('Admin profile options')).toContainText('Saved Name');
  expect(writes).toBe(1);
});

test('Settings saves only the display name and synchronizes the header and subsequent profile reads', async ({
  page,
}) => {
  await openSettings(page);
  let persisted = { ...testAdmin };
  const writes = [];
  await page.route('**/api/admin/me', async (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().headers().authorization).toBe('Bearer mock-admin-token');
      const body = route.request().postDataJSON();
      expect(body).toEqual({ name: 'New Admin Name' });
      writes.push(body);
      persisted = { ...persisted, name: body.name };
    }
    await route.fulfill({ json: { admin: persisted } });
  });
  await expect(page.getByLabel('Email (login identifier)')).toHaveAttribute('readonly', '');
  await page.getByLabel('Display name').fill('  New Admin Name  ');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Display name updated.' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue('New Admin Name');
  await expect(page.getByLabel('Admin profile options')).toContainText('New Admin Name');
  await expect(page.getByLabel('Email (login identifier)')).toHaveValue(testAdmin.email);
  await navigateWithinAdmin(page, '/admin/dashboard');
  await navigateWithinAdmin(page, '/admin/settings');
  await expect(page.getByLabel('Display name')).toHaveValue('New Admin Name');
  expect(writes).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    'mock-admin-token',
  );
  expect(page.url()).not.toContain('mock-admin-token');
});

test('Existing auth refresh updates Settings and header without a separate profile state', async ({
  page,
}) => {
  await openSettings(page);
  const updated = { ...testAdmin, name: 'Updated Account Name', email: 'updated@example.test' };
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { admin: updated } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Display name')).toHaveValue(updated.name);
  await expect(page.getByLabel('Email (login identifier)')).toHaveValue(updated.email);
  await expect(page.getByLabel('Admin profile options')).toContainText(updated.name);
});

test('A delayed profile refresh cannot overwrite a successful name update', async ({ page }) => {
  await openSettings(page);
  let release, started;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  await page.route('**/api/admin/me', async (route) => {
    if (route.request().method() === 'GET') {
      started();
      await gate;
      await route.fulfill({ json: { admin: testAdmin } });
    } else {
      await route.fulfill({ json: { admin: { ...testAdmin, name: 'Latest Name' } } });
    }
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await waiting;
  const finished = page.waitForEvent(
    'requestfinished',
    (request) => request.url().endsWith('/api/admin/me') && request.method() === 'GET',
  );
  try {
    await page.getByLabel('Display name').fill('Latest Name');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.getByLabel('Admin profile options')).toContainText('Latest Name');
  } finally {
    release();
  }
  await finished;
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(page.getByLabel('Display name')).toHaveValue('Latest Name');
  await expect(page.getByLabel('Admin profile options')).toContainText('Latest Name');
});

test('Logout still clears access from Settings', async ({ page }) => {
  await openSettings(page);
  await page.locator('#main-content').getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/settings?logout-check=1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/dashboard?logout-check=2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();

  await page.getByLabel('Admin email').fill(testAdmin.email);
  await page.locator('#login-password').fill('mock-admin-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/admin/dashboard');
});

for (const status of [401, 403]) {
  test(`A ${status} session verification removes Settings and redirects to login`, async ({
    page,
  }) => {
    await openSettings(page);
    await page.route('**/api/admin/me', (route) =>
      route.fulfill({ status, json: { message: 'Unauthorized' } }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page).toHaveURL('/admin/login');
    await expect(page.locator('#profile-email')).toHaveCount(0);
  });
}

test('Missing admin data is rejected rather than replaced by mock profile data', async ({
  page,
}) => {
  await openSettings(page);
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { admin: null } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL('/admin/login');
  await expect(page.locator('#profile-name')).toHaveCount(0);
});

test('Settings waits for the existing route verification and uses only its one request', async ({
  page,
}) => {
  await openSettings(page);
  await navigateWithinAdmin(page, '/admin/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  let release,
    started,
    requests = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  await page.route('**/api/admin/me', async (route) => {
    requests++;
    started();
    await gate;
    await route.fulfill({ json: { admin: testAdmin } });
  });
  await navigateWithinAdmin(page, '/admin/settings');
  await waiting;
  try {
    await expect(page.getByText('Verifying admin session…')).toBeVisible();
    await expect(page.locator('#profile-name')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByLabel('Display name')).toHaveValue(testAdmin.name);
  expect(requests).toBe(1);
});

for (const width of [360, 393, 768, 1024, 1440]) {
  test(`Settings preserve responsive fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await openSettings(page);
    await expect(page.getByLabel('Email (login identifier)')).toHaveValue(testAdmin.email);
    await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
