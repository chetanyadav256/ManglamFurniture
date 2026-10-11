import { expect, test } from '@playwright/test';

const mapsUrl =
  'https://www.google.com/maps/place/Manglam+Furniture/@26.9481105,75.7153494,17z/data=!3m1!4b1!4m6!3m5!1s0x396c4d206aedae43:0xeb1f42fef116b783!8m2!3d26.9481105!4d75.7179243!16s%2Fg%2F11j007s058?entry=ttu';
const address =
  '10, Kalwar Rd, near Rawan Gate Road, Officers Enclave, Jhotwara, Jaipur, Jaipur Nagar Nigam Area, Rajasthan 302012';
const instagramUrl = 'https://www.instagram.com/manglamfurnitureandelectronics/';

test('Contact address and map actions link accessibly to the confirmed Google Maps location', async ({
  page,
}) => {
  await page.goto('/contact');

  const addressLink = page.getByRole('link', {
    name: `Open ${address} in Google Maps`,
  });
  await expect(addressLink).toContainText(address);
  await expect(addressLink).toHaveAttribute('href', mapsUrl);
  await expect(addressLink).toHaveAttribute('target', '_blank');
  await expect(addressLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
    'href',
    mapsUrl,
  );
  await expect(page.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
    'target',
    '_blank',
  );
});

test('Header and Footer location links open the confirmed Maps URL safely', async ({ page }) => {
  await page.goto('/');

  const headerLocation = page.getByRole('link', { name: 'Find our showroom' });
  await expect(headerLocation).toHaveAttribute('href', mapsUrl);
  await expect(headerLocation).toHaveAttribute('target', '_blank');
  await expect(headerLocation).toHaveAttribute('rel', 'noopener noreferrer');

  const footerAddress = page.locator('footer').getByRole('link', { name: address });
  await expect(footerAddress).toHaveAttribute('href', mapsUrl);
  await expect(footerAddress).toHaveAttribute('target', '_blank');
  await expect(footerAddress).toHaveAttribute('rel', 'noopener noreferrer');
});

test('Both phone numbers are clickable from Contact and Footer', async ({ page }) => {
  await page.goto('/contact');

  for (const [number, href] of [
    ['+91 9782549345', 'tel:+919782549345'],
    ['+91 7615932887', 'tel:+917615932887'],
  ]) {
    await expect(page.getByRole('link', { name: number, exact: true }).first()).toHaveAttribute(
      'href',
      href,
    );
    await expect(page.locator('footer').getByRole('link', { name: number })).toHaveAttribute(
      'href',
      href,
    );
  }
});

test('Contact Instagram link uses the confirmed profile and safe external-link attributes', async ({
  page,
}) => {
  await page.goto('/contact');

  const instagram = page.getByRole('link', { name: '@manglamfurnitureandelectronics' });
  await expect(instagram).toHaveAttribute('href', instagramUrl);
  await expect(instagram).toHaveAttribute('target', '_blank');
  await expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
});
