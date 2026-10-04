import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { signIn } from './helpers';

const sheetRows = async (path: string) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const rows: { b: string; d: unknown; e: unknown; f: unknown }[] = [];
  wb.worksheets[0]!.eachRow((row, n) => {
    if (n > 14)
      rows.push({
        b: row.getCell(2).text,
        d: row.getCell(4).value,
        e: row.getCell(5).text,
        f: row.getCell(6).value,
      });
  });
  return rows;
};

test.describe('old invoices', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('reads an old invoice and makes the 2nd payment invoice', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File handling is viewport-independent');
    // An invoice made earlier with Quick quote: 12 switches and 15 downlights.
    await page.goto('/quote');
    await page.getByLabel('Client’s message').fill('- 12 switches\n- 15 downlights warm white');
    await page.getByLabel('Client’s name').fill('Mr Tan');
    await page.getByRole('button', { name: 'Read message' }).click();
    const [first] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download quotation (Excel)' }).click(),
    ]);
    const oldPath = testInfo.outputPath('old.xlsx');
    await first.saveAs(oldPath);
    const old = await sheetRows(oldPath);
    const deposit = old.find((r) => r.e === 'DEPOSIT REQUEST (S$)')!.f as { result: number };

    // Open it as an old invoice: lines as invoiced, the deposit it asked for suggested as paid.
    await page.getByRole('radio', { name: 'Old invoice: next payment' }).click();
    await page.getByLabel('Old invoice file').setInputFiles(oldPath);
    await expect(page.getByText(/this one is for the 2nd payment/)).toBeVisible();
    await expect(page.getByLabel('Client’s name')).toHaveValue('Mr Tan');
    await expect(page.getByRole('radio', { name: '2nd payment' })).toBeChecked();
    const paid = page.getByLabel('Already paid (S$)');
    await expect(paid).toHaveValue(String(deposit.result));
    const lines = page.getByRole('region', { name: 'Invoice lines' });
    await expect(lines.getByText('Nova Package').first()).toBeVisible();

    // Items changed since: a quantity, and a new line; the payment due follows.
    const due = page.getByTestId('old-invoice-due');
    const amount = async () => Number((await due.innerText()).replace(/[^\d.]/g, ''));
    const before = await amount();
    await lines.getByLabel(/^Quantity of Luna/).fill('16');
    await expect.poll(amount).toBeGreaterThan(before);
    await lines.getByPlaceholder('Description').fill('Smart Doorbell');
    await lines.getByLabel('New line unit price (S$)').fill('250');
    await lines.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(lines.getByText('Smart Doorbell')).toBeVisible();
    await page.screenshot({
      path: `test-results/screens/old-invoice-${testInfo.project.name}.png`,
      fullPage: true,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download invoice (Excel)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Invoice .* - 2nd payment - Mr Tan\.xlsx$/);
    const path = testInfo.outputPath('second.xlsx');
    await download.saveAs(path);
    const rows = await sheetRows(path);
    expect(rows.some((r) => r.b === 'Smart Doorbell' && r.d === 1)).toBe(true);
    expect(rows.find((r) => r.e === 'LESS PAID (S$)')?.f).toBe(deposit.result);
    const second = rows.find((r) => r.e === '2ND PAYMENT (S$)')!.f as { result: number };
    expect(second.result).toBeCloseTo(await amount(), 2);
  });
});

test.describe('electrical', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('prices electrical works from the average rates', async ({ page }, testInfo) => {
    await page.goto('/electrical');
    await expect(page.getByRole('heading', { name: 'Electrical' })).toBeVisible();
    const total = page.getByTestId('electrical-total');
    await page.getByLabel('Quantity of 13A single switched socket outlet (new point)').fill('3');
    await expect(total).toHaveText('S$225.00');
    await page.getByLabel('Quantity of Lighting point c/w 1-gang switch and wiring').fill('4');
    await expect(total).toHaveText('S$445.00');
    // Your electrician's own rate.
    await page.getByLabel('Rate for Lighting point c/w 1-gang switch and wiring').fill('50');
    await expect(total).toHaveText('S$425.00');
    await expect(page.getByRole('button', { name: 'Reset 1 rate to average' })).toBeVisible();
    await page.getByRole('switch', { name: 'Add GST (9%)' }).click();
    await expect(total).toHaveText('S$463.25');
    await page.screenshot({ path: `test-results/screens/electrical-${testInfo.project.name}.png` });

    if (testInfo.project.name !== 'desktop') return;
    await page.getByLabel('Client').fill('Mr Lim');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download quotation (Excel)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Electrical Quotation .* - Mr Lim\.xlsx$/);
    const path = testInfo.outputPath('electrical.xlsx');
    await download.saveAs(path);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await readFile(path)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const text: string[] = [];
    wb.worksheets[0]!.eachRow((row) => row.eachCell((c) => text.push(c.text)));
    const all = text.join('\n');
    expect(all).toContain('QUOTATION FOR ELECTRICAL WORKS');
    expect(all).toContain('13A single switched socket outlet (new point)');
    expect(all).toContain('GST 9%');
  });
});
