import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { issuedFromOld, parseOldInvoice } from '../src/quote/old-invoice.ts';
import { pdfInvoiceGrid, type PdfText } from '../src/quote/pdf-invoice.ts';

// The text of real PDFs as pdf.js reads it: an Excel invoice printed to PDF, the app's own
// quotation PDF, and a 5-page 2nd-payment invoice from the app.
const read = (name: string) =>
  parseOldInvoice(
    pdfInvoiceGrid(
      JSON.parse(
        readFileSync(new URL(`./fixtures/pdf-${name}.json`, import.meta.url), 'utf8'),
      ) as PdfText[],
    ),
  );
const items = (old: ReturnType<typeof read>) =>
  old.rows.flatMap((r) => (r.kind === 'item' ? [r] : []));
const sum = (old: ReturnType<typeof read>) =>
  Math.round(items(old).reduce((t, r) => t + r.quantity * r.unitPrice, 0) * 100) / 100;

describe('reading an invoice PDF', () => {
  it('reads an Excel invoice printed to PDF, with centred, wrapped descriptions', () => {
    const old = read('excel');
    assert.equal(items(old).length, 9);
    assert.equal(sum(old), 3922);
    assert.equal(old.total, 3922);
    assert.equal(old.deposit, 2353.2);
    assert.deepEqual([old.number, old.client.name, old.client.contact], ['MX1', 'Test', 'Jo']);
    assert.equal(
      items(old)[0]!.description.split('\n')[0],
      'Ark Core Package',
      'the package keeps its lines',
    );
    assert.match(items(old)[0]!.description, /Package Discounted to \$1390 from \$1690$/);
    assert.deepEqual(
      old.rows.flatMap((r) => (r.kind === 'section' ? [r.title] : [])),
      ['Lighting'],
    );
  });

  it('reads the app’s own quotation PDF, letter-spaced headings and all', () => {
    const old = read('quote');
    assert.equal(sum(old), 3922);
    assert.deepEqual(
      [old.number, old.date, old.client.name, old.total, old.deposit],
      ['MX1', '07 Oct 2026', 'Mr Test', 3922, 2353.2],
    );
    // A wrapped sentence reads as one line.
    assert.ok(
      items(old).some(
        (r) =>
          r.description ===
          'Add On Per Luna Smart Light Selection (Was $118 Per Light Discounted to $78 with Package Price)',
      ),
    );
    assert.ok(
      items(old).some((r) => r.description === 'Integration Waived' && r.unitPrice === -15),
    );
  });

  it('follows the table across pages, leaving out page titles and footers', () => {
    const old = read('second');
    assert.equal(items(old).length, 29);
    assert.equal(sum(old), 17492);
    assert.equal(old.total, 17492);
    assert.equal(old.lessPaid, 10495.2);
    assert.equal(old.secondPayment, 5247.6);
    assert.deepEqual(
      old.rows.flatMap((r) => (r.kind === 'section' ? [r.title] : [])),
      ['Lighting', 'Electrical works'],
    );
    assert.ok(
      items(old).some(
        (r) => r.description === 'Gadget model 5 with a fairly long product name for wrapping, x',
      ),
    );
    // So the next one to collect is the final payment.
    assert.equal(issuedFromOld(old).second?.due, 5247.6);
  });

  it('splits tightly packed rows at the table’s ruled lines (a scanned invoice)', () => {
    // Quantities sit at the bottom of their rows, and the rows are as close as the lines in them.
    const t = (x: number, y: number, str: string, width = 6 * str.length): PdfText => ({
      page: 1,
      x,
      y,
      width,
      height: 7,
      str,
    });
    const texts = [
      t(60, 700, 'ITEM/DESCRIPTION'),
      t(300, 700, 'QUANTITY'),
      t(370, 700, 'UNIT PRICE'),
      t(60, 680, 'Luna Premier Light Package'),
      t(60, 669, '(Total 12 Downlights)'),
      t(320, 669, '1'),
      t(390, 669, '988'),
      t(60, 658, 'Add On Per Luna Smart Light Selection'),
      t(60, 647, 'Discounted to $78'),
      t(320, 647, '4'),
      t(390, 647, '78'),
      t(60, 620, 'Smart Home + Installation Total Price'),
    ];
    const rules = [692, 664, 642, 630].map((y) => ({ page: 1, y }));
    const old = parseOldInvoice(pdfInvoiceGrid(texts, rules));
    assert.deepEqual(
      items(old).map((r) => [r.description, r.quantity, r.unitPrice]),
      [
        ['Luna Premier Light Package\n(Total 12 Downlights)', 1, 988],
        ['Add On Per Luna Smart Light Selection Discounted to $78', 4, 78],
      ],
    );
  });

  it('gives the lines as they are when there is no item table', () => {
    const grid = pdfInvoiceGrid([
      { page: 1, x: 50, y: 700, width: 40, height: 10, str: 'Hello' },
      { page: 1, x: 94, y: 700, width: 40, height: 10, str: 'world' },
      { page: 1, x: 300, y: 700, width: 20, height: 10, str: '12' },
    ]);
    // Close words share a cell; a wide gap starts the next.
    assert.deepEqual(grid, [['Hello world', '12']]);
  });
});
