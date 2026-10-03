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
    // One switch package per series, from the catalogue: Ark, Nova+ Pro and Lusano+.
    await expect(form.getByLabel('Switches per package')).toHaveCount(3);
    await expect(form.getByLabel('Package price (S$)').first()).toHaveValue('1390');
    await expect(form.getByText('Ark Series switch package')).toBeVisible();
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

  test('variants and whole series can be deleted from the catalogue', async ({ page }) => {
    await page.goto('/catalogue');
    await page.getByRole('button', { name: /^Ceiling Fans/ }).click();
    await page.getByRole('button', { name: 'Show variants of Breeze DC Ceiling Fan' }).click();
    const variants = page.getByRole('button', { name: /^Delete Breeze DC Ceiling Fan, / });
    const before = await variants.count();
    expect(before).toBeGreaterThan(1);
    await variants.first().click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Projects that already use it keep it');
    await confirm.getByRole('button', { name: 'Delete variant' }).click();
    await expect(variants).toHaveCount(before - 1);

    await page.getByRole('button', { name: 'Delete Breeze DC Ceiling Fan', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete series' }).click();
    await expect(page.getByText('Breeze DC Ceiling Fan')).toHaveCount(0);
    await expect(page.getByText('No products in this category yet.')).toBeVisible();
  });
});
