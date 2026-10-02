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
    await expect(page.getByRole('link', { name: 'Download' })).toHaveCount(4, { timeout: 60_000 });

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
      ].sort(),
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
    const link = panel.getByRole('link', { name: 'Download' });
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
});
