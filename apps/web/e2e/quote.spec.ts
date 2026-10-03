import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { signIn } from './helpers';

test.describe('quick quote', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('reads a client message into an exact quotation', async ({ page }, testInfo) => {
    await page.goto('/quote');
    await page.getByLabel('Client’s message').fill(`Hi, need a quote for my 5 room HDB:
- 12 switches
- 15 downlights warm white
- 2 motorised curtains
- 20m LED strip
- 2 bidets`);
    await page.getByLabel('Client’s name').fill('Mr Tan');
    await page.getByRole('button', { name: 'Read message' }).click();

    const items = page.getByRole('list', { name: 'Quoted items' });
    await expect(items.getByRole('listitem')).toHaveCount(5);
    // LED drivers come with the strip: one per 5 m.
    await expect(page.getByLabel('Quantity of item 5')).toHaveValue('4');
    // What it couldn't read is shown, not dropped.
    await expect(page.getByRole('alert').filter({ hasText: 'Not recognised' })).toContainText(
      '2 bidets',
    );

    // Priced as on the invoice: 12 switches make a 10-switch package plus 2 add-ons.
    const quote = page.getByRole('region', { name: 'Quotation' });
    await expect(quote.getByText('Nova Package').first()).toBeVisible();
    await expect(
      quote.getByText('Add-On Per Nova+ Pro Smart Switch', { exact: false }),
    ).toBeVisible();
    await expect(quote).toContainText('Total');
    await page.screenshot({
      path: `test-results/screens/quote-${testInfo.project.name}.png`,
      fullPage: true,
    });

    if (testInfo.project.name !== 'desktop') return;
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download quotation (Excel)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Quotation .* - Mr Tan\.xlsx$/);
    const path = testInfo.outputPath('quote.xlsx');
    await download.saveAs(path);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets[0]!.getCell('B11').value).toBe('Mr Tan');
  });
});
