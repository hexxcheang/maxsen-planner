import { expect, test } from '@playwright/test';
import { signIn, unlockAdmin } from './helpers';

test.describe('pricing', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await unlockAdmin(page);
  });

  test('package rates and the price catalogue live in Admin › Pricing', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Pricing' }).click();
    const form = page.getByRole('form', { name: 'Pricing' });
    await expect(form.getByLabel('Switches per package')).toHaveValue('10');
    await expect(form.getByLabel('Lights per package')).toHaveValue('12');
    await expect(form.getByLabel('Metres per package')).toHaveValue('30');
    await expect(form.getByLabel('Drivers per package')).toHaveValue('6');

    // Upload a catalogue PDF for reference.
    await page.getByLabel('Upload price catalogue').setInputFiles({
      name: 'Catalog Newest.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
    });
    await expect(form.getByRole('link', { name: 'Catalog Newest.pdf' })).toBeVisible();

    await form.getByLabel('Deposit requested (%)').fill('50');
    await form.getByRole('button', { name: 'Save pricing' }).click();
    await page.screenshot({
      path: `test-results/screens/admin-pricing-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page.reload();
    await page.getByRole('tab', { name: 'Pricing' }).click();
    await expect(
      page.getByRole('form', { name: 'Pricing' }).getByLabel('Deposit requested (%)'),
    ).toHaveValue('50');
  });

  test('device prices are set per variant in Catalogue', async ({ page }) => {
    await page.goto('/catalogue');
    await page.getByRole('button', { name: /^Ceiling Fans/ }).click();
    await page.getByRole('button', { name: 'Show variants of Breeze DC Ceiling Fan' }).click();
    await expect(page.getByText('No price').first()).toBeVisible();
    await page.getByRole('button', { name: /Edit Breeze DC Ceiling Fan, 52/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit variant' });
    await expect(dialog.getByText(/Never shown to the client/)).toBeVisible();
    await dialog.getByLabel('Price', { exact: true }).fill('459');
    await dialog.getByRole('button', { name: 'Save variant' }).click();
    await expect(page.getByText('S$459.00')).toBeVisible();
  });
});
