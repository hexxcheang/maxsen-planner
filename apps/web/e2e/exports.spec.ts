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
    await expect(page.getByRole('link', { name: 'Download' })).toHaveCount(3, { timeout: 60_000 });

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
});
