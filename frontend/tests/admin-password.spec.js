import { test, expect } from '@playwright/test';
import { signInToAdmin, navigateWithinAdmin } from './adminAuthFixture';

const current = 'test-current-password';
const next = ' test-new-password ';
async function open(page) {
  await page.route('**/api/**', (route) => route.fulfill({ json: { products: [], categories: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } } }));
  await signInToAdmin(page);
  await navigateWithinAdmin(page, '/admin/settings');
  await expect(page.locator('#settings-password-current')).toBeVisible();
}
async function fill(page, value = next, confirmation = value) {
  await page.locator('#settings-password-current').fill(current);
  await page.locator('#settings-password-next').fill(value);
  await page.locator('#settings-password-confirm').fill(confirmation);
}
const submit = (page) => page.getByRole('button', { name: 'Change password', exact: true }).click();
async function assertSessionCleared(page) {
  // Do not wait for a protected URL that the guard immediately replaces.
  await page.evaluate(() => {
    history.pushState({}, '', '/admin/settings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL('/admin/login');
  await expect(page.locator('#settings-password-current')).toHaveCount(0);
}

test('Confirmed success sends only two fields, clears session and requires a fresh login without persistence', async ({ page }) => {
  await open(page);
  let calls = 0, logins = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/admin/login')) logins++; });
  await page.route('**/api/admin/me/password', (route) => {
    calls++;
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().headers().authorization).toBe('Bearer mock-admin-token');
    expect(route.request().postDataJSON()).toEqual({ currentPassword: current, newPassword: next });
    return route.fulfill({ json: { message: 'Password changed. Please sign in again.' } });
  });
  await expect(page.locator('#settings-password-current')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#settings-password-next')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#settings-password-confirm')).toHaveAttribute('autocomplete', 'new-password');
  await fill(page); await submit(page);
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByRole('status')).toContainText('Password changed. Please sign in again');
  await expect(page.locator('#login-password')).toHaveValue('');
  expect(calls).toBe(1); expect(logins).toBe(0);
  const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, history.state, location.href]));
  for (const sensitive of [current, next, 'mock-admin-token']) expect(stored).not.toContain(sensitive);
  await assertSessionCleared(page);
});

test('Required, minimum character count, confirmation and UTF-8 byte limits validate without requests', async ({ page }) => {
  await open(page);
  let calls = 0;
  await page.route('**/api/admin/me/password', (route) => { calls++; return route.fulfill({ status: 400, json: { message: 'Unexpected request' } }); });
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('Complete all three');
  for (const [value, confirmation, message] of [
    ['short', 'short', 'at least 12'], ['😀'.repeat(11), '😀'.repeat(11), 'at least 12'],
    [next, 'different-confirmation', 'do not match'], ['界'.repeat(25), '界'.repeat(25), '72 UTF-8 bytes'],
  ]) {
    await fill(page, value, confirmation); await submit(page);
    await expect(page.getByRole('alert')).toContainText(message);
  }
  expect(calls).toBe(0);
});

test('Exactly 72 Unicode bytes reach the backend unchanged', async ({ page }) => {
  await open(page);
  const value = '界'.repeat(24);
  await page.route('**/api/admin/me/password', (route) => {
    expect(route.request().postDataJSON().newPassword).toBe(value);
    return route.fulfill({ status: 400, json: { message: 'Current password is incorrect.' } });
  });
  await fill(page, value); await submit(page);
  await expect(page.getByRole('alert')).toHaveText('Current password is incorrect.');
});

for (const [status, message, expected] of [
  [400, 'Current password is incorrect.', 'Current password is incorrect.'],
  [400, 'New password must differ from the current password.', 'New password must differ'],
  [429, 'Rate limit', 'Please wait before trying again'],
  [409, 'Account changed during this request. Please sign in again.', 'Please sign in again'],
  [500, 'Internal server error.', 'Unable to confirm whether your password changed'],
  [0, '', 'Unable to confirm whether your password changed'],
]) {
  test(`Password failure ${status}: ${message || 'network'} preserves fields and shows safe feedback`, async ({ page }) => {
    await open(page);
    await page.route('**/api/admin/me/password', (route) => status ? route.fulfill({ status, json: { message } }) : route.abort('failed'));
    await fill(page); await submit(page);
    await expect(page.getByRole('alert')).toContainText(expected);
    await expect(page.locator('#settings-password-current')).toHaveValue(current);
    await expect(page.locator('#settings-password-next')).toHaveValue(next);
    await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeEnabled();
  });
}

for (const status of [401, 403]) {
  test(`Password ${status} clears the session`, async ({ page }) => {
    await open(page);
    await page.route('**/api/admin/me/password', (route) => route.fulfill({ status, json: { message: 'Unauthorized' } }));
    await fill(page); await submit(page);
    await expect(page).toHaveURL('/admin/login');
    await assertSessionCleared(page);
  });
}

test('Pending password changes block duplicate submissions', async ({ page }) => {
  await open(page);
  let release, started, calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const waiting = new Promise((resolve) => { started = resolve; });
  await page.route('**/api/admin/me/password', async (route) => {
    calls++; started(); await gate;
    await route.fulfill({ status: 400, json: { message: 'Current password is incorrect.' } });
  });
  await fill(page);
  await page.locator('#settings-password-current').evaluate((input) => { input.form.requestSubmit(); input.form.requestSubmit(); });
  await waiting;
  try {
    await expect(page.getByRole('button', { name: 'Changing password' })).toBeDisabled();
    await expect(page.locator('#settings-password-current')).toBeDisabled();
    await page.locator('#settings-password-current').evaluate((input) => input.form.requestSubmit());
  } finally { release(); }
  await expect(page.getByRole('alert')).toBeVisible();
  expect(calls).toBe(1);
});
