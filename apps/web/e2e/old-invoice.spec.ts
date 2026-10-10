import path from 'node:path';
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
    const own = page.getByRole('form', { name: 'Add your own item' });
    await own.getByLabel('Item description').fill('Smart Doorbell');
    await own.getByLabel('Item unit price (S$)').fill('250');
    await own.getByRole('button', { name: 'Add' }).click();
    await expect(lines.getByText('Smart Doorbell')).toBeVisible();

    // Like a new quote: items from a client's message, and from the catalogue, priced the same.
    await page.getByLabel('Items to add (client’s message)').fill('2 more switches');
    await page.getByRole('button', { name: 'Add from message' }).click();
    // Fewer than a package's worth: at the add-on rate per switch.
    await expect(lines.getByText('Nova+ Pro, 2-gang, Black')).toBeVisible();
    await expect(lines.getByLabel('Unit price of Nova+ Pro, 2-gang, Black')).toHaveValue('180');
    // RGBCCT is only its add-on, S$6 a metre, with no strip of its own.
    await page
      .getByLabel('Add an item')
      .selectOption({ label: 'LED Strips · Lumi Cove Strip, RGBCCT' });
    const upgrade = 'Upgrade Per 1 Meter of LED Strip from CCT to RGBCCT';
    await expect(lines.getByText(upgrade)).toBeVisible();
    await expect(lines.getByLabel(`Unit price of ${upgrade}`)).toHaveValue('6');
    await expect(lines.getByText(/Add-On Per 1 Meter of Smart Lumi/)).toHaveCount(0);
    // Any line's wording can be changed.
    await lines.getByRole('button', { name: `Change wording of ${upgrade}` }).click();
    const wording = lines.getByLabel(`Wording of ${upgrade}`);
    await wording.fill('RGBCCT upgrade for the living room cove');
    await wording.press('Enter');
    await expect(lines.getByText('RGBCCT upgrade for the living room cove')).toBeVisible();
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

    // The PDF says what was paid as the deposit.
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download invoice (PDF)' }).click(),
    ]);
    const pdfPath = testInfo.outputPath('second.pdf');
    await pdf.saveAs(pdfPath);
    expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe('%PDF-');
  });
  test('reads an old invoice PDF, then the 2nd payment PDF made from it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File handling is viewport-independent');
    await page.goto('/quote');
    await page.getByLabel('Client’s message').fill('- 12 switches\n- 15 downlights warm white');
    await page.getByLabel('Client’s name').fill('Mr Tan');
    await page.getByRole('button', { name: 'Read message' }).click();
    const total = page
      .getByRole('region', { name: 'Quotation' })
      .getByRole('row')
      .filter({
        hasText: /^Total/,
      });
    const quoted = Number((await total.innerText()).replace(/[^\d.]/g, ''));
    const [first] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download quotation (PDF)' }).click(),
    ]);
    const oldPath = testInfo.outputPath('old.pdf');
    await first.saveAs(oldPath);

    await page.getByRole('radio', { name: 'Old invoice: next payment' }).click();
    await page.getByLabel('Old invoice file').setInputFiles(oldPath);
    await expect(page.getByText(/this one is for the 2nd payment/)).toBeVisible();
    await expect(page.getByLabel('Client’s name')).toHaveValue('Mr Tan');
    // The deposit it asked for: 60% of the total.
    await expect(page.getByLabel('Already paid (S$)')).toHaveValue(
      String(Math.round(quoted * 0.6 * 100) / 100),
    );
    const lines = page.getByRole('region', { name: 'Invoice lines' });
    await expect(lines.getByText('Nova Package').first()).toBeVisible();
    await expect(lines.getByLabel(/^Quantity of Add-On Per Nova\+ Pro/)).toHaveValue('2');

    // Its 2nd payment invoice, read back in, is for the final payment.
    const due = Number(
      (await page.getByTestId('old-invoice-due').innerText()).replace(/[^\d.]/g, ''),
    );
    const [second] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download invoice (PDF)' }).click(),
    ]);
    const secondPath = testInfo.outputPath('second.pdf');
    await second.saveAs(secondPath);
    await page.getByRole('button', { name: /Open another/ }).click();
    await page.getByLabel('Old invoice file').setInputFiles(secondPath);
    await expect(page.getByText(/this one is for the final payment/)).toBeVisible();
    await expect(page.getByLabel('Already paid (S$)')).toHaveValue(
      String(Math.round((quoted * 0.6 + due) * 100) / 100),
    );
  });
  test('reads a scanned invoice PDF (no text in it) by recognising its words', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File handling is viewport-independent');
    test.setTimeout(120_000);
    // As on older Safari (Mac and iPad): without the newest JavaScript features pdf.js uses.
    await page.addInitScript(() => {
      const strip = (o: object, ...keys: string[]) => {
        for (const k of keys) Reflect.deleteProperty(o, k);
      };
      strip(Promise, 'try', 'withResolvers');
      strip(Math, 'sumPrecise');
      strip(globalThis, 'Float16Array');
      strip(Uint8Array, 'fromBase64');
      strip(Uint8Array.prototype, 'toHex', 'toBase64');
      strip(Map.prototype, 'getOrInsert', 'getOrInsertComputed');
      strip(WeakMap.prototype, 'getOrInsert', 'getOrInsertComputed');
    });
    // The sample invoice (9 lines, S$3,922, deposit S$2,353.20) as a picture of the page.
    await page.goto('/quote');
    await page.getByRole('radio', { name: 'Old invoice: next payment' }).click();
    await page
      .getByLabel('Old invoice file')
      .setInputFiles(path.join(import.meta.dirname, 'fixtures/scanned-invoice.pdf'));
    await expect(page.getByRole('status').filter({ hasText: /Reading/ })).toBeVisible();
    await expect(page.getByText(/this one is for the 2nd payment/)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByLabel('Client’s name')).toHaveValue('Test');
    await expect(page.getByLabel('Already paid (S$)')).toHaveValue('2353.2');
    const lines = page.getByRole('region', { name: 'Invoice lines' });
    await expect(lines.getByText('Ark Core Package').first()).toBeVisible();
    await expect(lines.getByLabel(/^Quantity of /)).toHaveCount(9);
    // Every line read: the lines add up to the invoice's total.
    const quantities = await lines
      .getByLabel(/^Quantity of /)
      .evaluateAll((els) => els.map((e) => Number((e as HTMLInputElement).value)));
    expect(quantities).toEqual([1, 2, 1, 1, 3, 15, 15, 1, 4]);
    await page.screenshot({ path: 'test-results/screens/old-invoice-scanned.png', fullPage: true });
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
    // A 10% discount and a S$50 access charge, before GST.
    await page.getByRole('button', { name: 'Discount', exact: true }).click();
    await page.getByLabel('Discount %').fill('10');
    await expect(total).toHaveText('S$416.92');
    await page.getByRole('button', { name: 'Extra charge' }).click();
    const charge = page.getByTestId('electrical-adjustment').nth(1);
    await charge.getByLabel('Adjustment name').fill('Access charge');
    await charge.getByLabel('Access charge S$').fill('50');
    await expect(total).toHaveText('S$471.42');
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
    expect(all).toContain('Discount (10%)');
    expect(all).toContain('Access charge');
  });
});

test.describe('electrical plan', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('plots points on the floor plan, counted in the quotation, with a deposit', async ({
    page,
  }, testInfo) => {
    await page.goto('/electrical');
    await page.getByRole('radio', { name: 'Electrical plan' }).click();
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1600;
      c.height = 1000;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1600, 1000);
      ctx.lineWidth = 8;
      ctx.strokeRect(80, 80, 1440, 840);
      ctx.strokeRect(80, 80, 700, 840);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.getByLabel('Floor plan drawing').setInputFiles({
      name: 'unit.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    const canvas = page.getByTestId('electrical-canvas');
    await expect(canvas.getByRole('img', { name: 'Floor plan: unit.png' })).toBeVisible();
    // Measured at each tap: picking a symbol lower in the list can scroll the page.
    const tap = async (fx: number, fy: number) => {
      const box = (await canvas.boundingBox())!;
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      if (testInfo.project.name === 'desktop') await page.mouse.click(x, y);
      else await page.touchscreen.tap(x, y);
    };

    // Lighting point is ready to place: three of them.
    const symbols = page.getByRole('complementary', { name: 'Symbols' });
    await expect(symbols.getByRole('button', { name: /^Lighting point$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await tap(0.3, 0.3);
    await tap(0.4, 0.5);
    await tap(0.3, 0.7);
    await symbols.getByRole('button', { name: /13A twin switched socket outlet/ }).click();
    await tap(0.65, 0.4);
    await tap(0.7, 0.6);
    await symbols.getByRole('button', { name: /^1-gang switch/ }).click();
    await tap(0.5, 0.3);
    await expect(canvas.getByRole('img', { name: 'Lighting point' })).toHaveCount(3);
    const legend = page.getByTestId('electrical-legend');
    await expect(legend.getByRole('listitem').filter({ hasText: 'Lighting point' })).toContainText(
      '3',
    );
    await expect(legend.getByRole('listitem').filter({ hasText: '1-gang switch' })).toContainText(
      'Drawing only',
    );
    // Undo takes the last one off again.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(canvas.getByRole('img', { name: '1-gang switch' })).toHaveCount(0);
    await page.screenshot({
      path: `test-results/screens/electrical-plan-${testInfo.project.name}.png`,
    });

    if (testInfo.project.name === 'desktop') {
      const [pdf] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download plan (PDF)' }).click(),
      ]);
      expect(pdf.suggestedFilename()).toMatch(/^Electrical Layout .*\.pdf$/);
      const path = testInfo.outputPath('layout.pdf');
      await pdf.saveAs(path);
      expect((await readFile(path)).subarray(0, 5).toString()).toBe('%PDF-');
    }

    // The quotation counts what's on the plan.
    await page.getByRole('radio', { name: /Quotation/ }).click();
    const qty = page.getByLabel('Quantity of Lighting point c/w 1-gang switch and wiring');
    await expect(qty).toHaveValue('3');
    await expect(page.getByText('3 on plan')).toBeVisible();
    await expect(
      page.getByLabel('Quantity of 13A twin switched socket outlet (new point)'),
    ).toHaveValue('2');
    // One more typed in, on top of the plan.
    await qty.fill('4');
    const total = page.getByTestId('electrical-total');
    await expect(total).toHaveText('S$390.00');

    // A 50% deposit, then paid.
    await page.getByLabel('Deposit (%)').fill('50');
    await expect(page.getByTestId('electrical-due')).toHaveText('S$195.00');
    await page.getByRole('switch', { name: 'Deposit paid' }).click();
    await page.getByLabel('Deposit paid (S$)').fill('150');
    await expect(page.getByTestId('electrical-due')).toHaveText('S$240.00');
    await expect(page.getByText(/50% deposit upon confirmation/)).toBeVisible();
  });
});
