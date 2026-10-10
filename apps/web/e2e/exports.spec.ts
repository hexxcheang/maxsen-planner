import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { signIn } from './helpers';

test.describe('exports', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('generate all exports and download real files', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File generation is viewport-independent');
    test.setTimeout(90_000);
    await page.goto('/projects/proj_sample_lim/exports');
    await page.getByRole('button', { name: 'Generate all exports' }).click();
    await expect(page.getByRole('link', { name: 'Download' })).toHaveCount(5, { timeout: 60_000 });

    const files: Record<string, Buffer> = {};
    for (const link of await page.getByRole('link', { name: 'Download' }).all()) {
      const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
      const path = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(path);
      files[download.suggestedFilename()] = await readFile(path);
    }
    const title = 'Lim Family Home - Serangoon Gardens';
    expect(Object.keys(files).sort()).toEqual(
      [
        `${title} - Marked Floor Plan.pdf`,
        `${title} - Product Description.pdf`,
        `${title} - Quantity List.xlsx`,
        `${title} - Invoice.xlsx`,
        `${title} - Invoice.pdf`,
      ].sort(),
    );
    // The invoice also comes as the premium PDF: cover, items and terms pages.
    const invoicePdf = files[`${title} - Invoice.pdf`]!;
    expect(invoicePdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(invoicePdf.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThanOrEqual(
      3,
    );

    const plan = files[`${title} - Marked Floor Plan.pdf`]!;
    expect(plan.subarray(0, 5).toString()).toBe('%PDF-');
    // Cover plus five plan pages (Level 1 and Level 2 both plans, Attic lighting only).
    expect(plan.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(6);

    const product = files[`${title} - Product Description.pdf`]!;
    expect(product.subarray(0, 5).toString()).toBe('%PDF-');

    const wb = new ExcelJS.Workbook();
    // exceljs types predate generic Node Buffers.
    await wb.xlsx.load(
      files[`${title} - Quantity List.xlsx`]! as unknown as Parameters<typeof wb.xlsx.load>[0],
    );
    const ws = wb.getWorksheet('Quantities')!;
    expect(ws.getRow(1).getCell(1).value).toBe('Customer contact number: +65 8765 4321');
    expect(ws.getRow(2).values).toEqual([undefined, 'Category', 'Product', 'Variant', 'Quantity']);
    const values: unknown[][] = [];
    ws.eachRow((row) => values.push(row.values as unknown[]));
    expect(values.some((v) => v[2] === 'Smart LED Driver')).toBe(true);
    expect(values.some((v) => v[1] === 'Lighting Products')).toBe(true);
  });

  test('the invoice follows the template, with packages and catalogue prices', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File generation is viewport-independent');
    await page.goto('/projects/proj_sample_lim/exports');
    const panel = page.getByRole('region', { name: 'Invoice' });
    const number = panel.getByLabel('Invoice number');
    await number.fill('MXN-HX-TEST01');
    await expect(panel.getByText(/Packages/)).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/exports-invoice.png', fullPage: true });
    await panel.getByRole('button', { name: 'Generate' }).click();
    const link = panel.getByRole('link', { name: 'Download Excel' });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    expect(download.suggestedFilename()).toBe('Lim Family Home - Serangoon Gardens - Invoice.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0]!;
    expect(ws.name).toBe('Smart Home Charges');
    expect(ws.getCell('A1').value).toBe('MAXSEN SMART HOME');
    expect(ws.getCell('F8').value).toBe('MXN-HX-TEST01');
    expect(ws.getCell('B11').value).toBe('Lim Wei Jie');
    expect(ws.getCell('B14').value).toBe('ITEM/DESCRIPTION');
    expect(ws.getCell('A14').font.name).toBe('Trebuchet MS');
    const rows: { b: string; d: unknown; e: unknown; f: unknown }[] = [];
    ws.eachRow((row, n) => {
      if (n <= 14) return;
      rows.push({
        b: row.getCell(2).text,
        d: row.getCell(4).value,
        e: row.getCell(5).value,
        f: row.getCell(6).value,
      });
    });
    expect(rows.some((r) => r.b === 'Lighting')).toBe(true);
    expect(rows.some((r) => /Integration Waived/.test(r.b))).toBe(true);
    expect(rows.some((r) => r.b.startsWith('2 Years On-Site Warranty'))).toBe(true);
    const total = rows.find((r) => r.b === 'Smart Home + Installation Total Price')!;
    expect((total.f as { formula: string }).formula).toMatch(/^SUM\(F15:F\d+\)$/);
    expect(rows.some((r) => r.b.startsWith('Delivery Terms'))).toBe(true);
  });

  test('2nd and final invoices suggest what was paid and ask for the rest', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File generation is viewport-independent');
    await page.goto('/projects/proj_sample_lim/exports');
    const panel = page.getByRole('region', { name: 'Invoice' });
    const due = panel.getByTestId('invoice-due');
    const money = async () => Number(/[\d.]+/.exec((await due.innerText()).replace(/,/g, ''))?.[0]);

    // The deposit invoice records what it asked for.
    await panel.getByRole('button', { name: 'Generate' }).click();
    await expect(panel.getByRole('link', { name: 'Download Excel' })).toBeVisible();
    const deposit = await money();

    await panel.getByRole('radio', { name: '2nd payment' }).click();
    const paid = panel.getByLabel('Already paid (S$)');
    await expect(paid).toHaveValue(String(deposit));
    await expect(panel.getByText(/Suggested from Deposit invoice/)).toBeVisible();
    const second = await money();
    await panel.screenshot({ path: 'test-results/screens/exports-invoice-second.png' });
    expect(second).toBeGreaterThan(0);

    // Change what was collected: the amount due follows at once, and can be reset.
    await paid.fill(String(deposit - 100));
    await expect.poll(money).toBeCloseTo(second + 100, 2);
    await panel.getByRole('button', { name: 'Use suggested' }).click();
    await expect(paid).toHaveValue(String(deposit));

    await panel.getByRole('button', { name: /Generate/ }).click();
    const link = panel.getByRole('link', { name: 'Download Excel' });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toBe(
      'Lim Family Home - Serangoon Gardens - 2nd Payment Invoice.xlsx',
    );
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const labels: Record<string, unknown> = {};
    wb.worksheets[0]!.eachRow((row, n) => {
      if (n > 14) labels[row.getCell(5).text] = row.getCell(6).value;
    });
    expect(labels['LESS PAID (S$)']).toBe(deposit);
    expect((labels['2ND PAYMENT (S$)'] as { result: number }).result).toBeCloseTo(second, 2);

    // The final invoice suggests deposit + 2nd payment, and asks for the balance.
    await panel.getByRole('radio', { name: 'Final' }).click();
    await expect(paid).toHaveValue(String(Math.round((deposit + second) * 100) / 100));
    await expect(panel.getByText(/\(balance\)/)).toBeVisible();

    // Its terms: the balance, the warranty and handing over the smartlife home, not a deposit.
    await panel.getByRole('button', { name: /Generate/ }).click();
    const [finalDownload] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('link', { name: 'Download Excel' }).click(),
    ]);
    expect(finalDownload.suggestedFilename()).toMatch(/Final Invoice\.xlsx$/);
    const finalPath = testInfo.outputPath(finalDownload.suggestedFilename());
    await finalDownload.saveAs(finalPath);
    const fwb = new ExcelJS.Workbook();
    await fwb.xlsx.load(
      (await readFile(finalPath)) as unknown as Parameters<typeof fwb.xlsx.load>[0],
    );
    const texts: string[] = [];
    fwb.worksheets[0]!.eachRow((row) =>
      row.eachCell((c) => {
        if (typeof c.value === 'string') texts.push(c.value);
      }),
    );
    const terms = texts.join('\n');
    expect(terms).toContain('Final Payment Terms:');
    expect(terms).toContain('transfer ownership of the home in the smartlife application');
    expect(terms).not.toContain('after receiving 60% deposit');
  });

  test('prices and discounts set on the project carry into the invoice', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File generation is viewport-independent');
    await page.goto('/projects/proj_sample_lim/exports');
    const panel = page.getByRole('region', { name: 'Invoice' });
    await panel.getByRole('button', { name: 'Prices and discounts' }).click();
    const dialog = page.getByRole('dialog', { name: 'Prices and discounts' });
    const discount = dialog.getByLabel(/^Discount on /).first();
    const item = ((await discount.getAttribute('aria-label')) ?? '').replace('Discount on ', '');
    await discount.fill('100');
    await expect(dialog.getByText(`Discount: ${item}`)).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/exports-invoice-prices.png' });
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(
      panel.getByText(/1 row with your own price or discount, S\$100\.00 off/),
    ).toBeVisible();

    // Saved with the project: still there after a reload, and on the invoice.
    await page.reload();
    await panel.getByRole('button', { name: 'Generate' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('link', { name: 'Download Excel' }).click(),
    ]);
    const path = testInfo.outputPath('invoice.xlsx');
    await download.saveAs(path);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const rows: { b: string; e: unknown }[] = [];
    wb.worksheets[0]!.eachRow((row, n) => {
      if (n > 14) rows.push({ b: row.getCell(2).text, e: row.getCell(5).value });
    });
    expect(rows.find((r) => r.b === `Discount: ${item}`)?.e).toBe(-100);
  });

  test('electrical works are added to the invoice from the Electrical rates', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File generation is viewport-independent');
    await page.goto('/projects/proj_sample_lim/exports');
    const panel = page.getByRole('region', { name: 'Invoice' });
    await panel.getByRole('button', { name: 'Add electrical works' }).click();
    const pick = page.getByRole('dialog', { name: 'Add electrical works' });
    await pick.getByLabel('How many: Neutral wire to switch point (for smart switches)').fill('6');
    await pick.getByRole('searchbox', { name: 'Search electrical works' }).fill('profile');
    await pick
      .getByLabel('How many: Supply and install aluminium LED profile c/w diffuser (cove)')
      .fill('12');
    await expect(pick.getByTestId('electrical-pick-total')).toHaveText('2 items, S$564.00');
    await pick.getByRole('button', { name: 'Add to invoice' }).click();
    await expect(panel.getByTestId('electrical-works-summary')).toContainText(
      'Electrical works: 2 lines, S$564.00',
    );

    // They show under Electrical works, where the quantity can still change.
    await panel.getByRole('button', { name: 'Prices and discounts' }).click();
    const dialog = page.getByRole('dialog', { name: 'Prices and discounts' });
    await expect(dialog.getByText('Electrical works', { exact: true })).toBeVisible();
    await dialog
      .getByLabel('Quantity of Neutral wire to switch point (for smart switches)')
      .fill('8');
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(panel.getByTestId('electrical-works-summary')).toContainText('S$664.00');

    await panel.getByRole('button', { name: 'Generate' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('link', { name: 'Download Excel' }).click(),
    ]);
    const path = testInfo.outputPath('invoice-works.xlsx');
    await download.saveAs(path);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const rows: { b: string; d: unknown; e: unknown }[] = [];
    wb.worksheets[0]!.eachRow((row, n) => {
      if (n > 14)
        rows.push({ b: row.getCell(2).text, d: row.getCell(4).value, e: row.getCell(5).value });
    });
    expect(rows.some((r) => r.b === 'Electrical works')).toBe(true);
    const neutral = rows.find((r) => r.b === 'Neutral wire to switch point (for smart switches)')!;
    expect([neutral.d, neutral.e]).toEqual([8, 50]);
  });
});
