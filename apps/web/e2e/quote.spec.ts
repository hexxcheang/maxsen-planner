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

    // Typing a new quantity updates the quotation straight away, without leaving the box:
    // 25 switches is the one package plus 15 add-ons.
    const addOn = quote.getByRole('row', { name: /Add-On Per Nova\+ Pro Smart Switch/ });
    await expect(addOn).toContainText('2');
    await page.getByLabel('Quantity of item 1').fill('25');
    await expect(addOn.getByRole('cell').nth(1)).toHaveText('15');
    await expect(page.getByLabel('Quantity of item 1')).toBeFocused();

    // Unit prices can be changed and discounts given per item (S$ or %); the total follows.
    const totalCell = quote
      .getByRole('row', { name: /^Total/ })
      .getByRole('cell')
      .last();
    const amount = async () => Number((await totalCell.innerText()).replace(/[^\d.]/g, ''));
    const before = await amount();
    await quote.getByLabel(/^Unit price of Add-On Per Nova\+ Pro/).fill('150');
    await expect.poll(amount).toBeCloseTo(before - 15 * 30, 2);
    await quote.getByLabel(/^Discount on Nova Package/).fill('10%');
    await expect(quote.getByText(/^Discount 10%: Nova Package/)).toBeVisible();
    await expect.poll(amount).toBeCloseTo(before - 15 * 30 - 199, 2);
    await page.screenshot({
      path: `test-results/screens/quote-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Electrical works from the Electrical rates join the quotation under their own heading.
    const beforeWorks = await amount();
    await page.getByRole('button', { name: 'Add electrical works' }).click();
    const pick = page.getByRole('dialog', { name: 'Add electrical works' });
    await pick.getByLabel('How many: 13A twin switched socket outlet (new point)').fill('2');
    await pick.getByRole('button', { name: 'Add to invoice' }).click();
    await expect(quote.getByText('Electrical works', { exact: true })).toBeVisible();
    await expect.poll(amount).toBeCloseTo(beforeWorks + 170, 2);

    // An item of your own, typed in, under "Additional items"; its wording can be fixed after.
    const own = page.getByRole('form', { name: 'Add your own item' });
    await own.getByLabel('Item description').fill('Site visit and transprt');
    await own.getByLabel('Item quantity').fill('2');
    await own.getByLabel('Item unit price (S$)').fill('45');
    await own.getByRole('button', { name: 'Add' }).click();
    await expect(quote.getByText('Additional items', { exact: true })).toBeVisible();
    await expect.poll(amount).toBeCloseTo(beforeWorks + 170 + 90, 2);
    const wording = quote.getByLabel('Description of Site visit and transprt');
    await wording.fill('Site visit and transport');
    await wording.press('Enter');
    await expect(quote.getByLabel('Description of Site visit and transport')).toBeVisible();

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
    const sheet: { b: string; e: unknown }[] = [];
    wb.worksheets[0]!.eachRow((row, n) => {
      if (n > 14) sheet.push({ b: row.getCell(2).text, e: row.getCell(5).value });
    });
    expect(sheet.find((r) => r.b.startsWith('Add-On Per Nova+ Pro'))?.e).toBe(150);
    expect(sheet.find((r) => r.b.startsWith('Discount 10%: Nova Package'))?.e).toBe(-199);
    expect(sheet.find((r) => r.b === 'Site visit and transport')?.e).toBe(45);

    // And as a proposal-style PDF.
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download quotation (PDF)' }).click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/^Quotation .* - Mr Tan\.pdf$/);
    const pdfPath = testInfo.outputPath('quote.pdf');
    await pdfDownload.saveAs(pdfPath);
    const pdf = await readFile(pdfPath);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // A cover and at least one page of items.
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThanOrEqual(2);
  });
});
