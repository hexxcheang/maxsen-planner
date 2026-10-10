import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { issuedFromOld, parseOldInvoice, type Cell } from '../src/quote/old-invoice.ts';
import { ELECTRICAL_RATES } from '../src/electrical/rates.ts';

// Cells as the invoice template lays them out (A–F).
const template: Cell[][] = [
  ['MAXSEN SMART HOME', null, null, null, null, null],
  ['Website: http://www.maxsen.sg', null, null, null, 'DATE', '2026-09-01'],
  [null, null, null, null, 'INVOICE #', 'MXN-HX-26090101'],
  ['TO:', null, null, null, null, null],
  ['Phone:', '91234567', null, null, null, null],
  ['Name:', 'Mr Tan', null, null, null, null],
  ['S/N', 'ITEM/DESCRIPTION', 'ITEM/DESCRIPTION', 'QUANTITY', 'UNIT PRICE (S$)', 'PRICE (S$)'],
  [1, 'Ark Core Package\n10 x Ark Series Smart Switches', null, 1, 1390, 1390],
  [2, 'Add-On Per Ark Series Smart Switch with Installation', null, 2, 100, 200],
  [null, 'Lighting', null, null, null, null],
  [3, 'Luna Downlight, 3000K', null, 15, 78, 1170],
  [5, 'Light Package of 12\n(Total 12 Selection of Downlights)', null, 1, 988, 988],
  [4, 'Integration Waived', null, 15, -12, -180],
  [null, '2 Years On-Site Warranty for All Devices Stated in the Invoice.', null, null, null, null],
  [null, 'Smart Home + Installation Total Price', null, null, null, 2580],
  [null, null, null, null, 'GRANT TOTAL (S$)', 2580],
  [null, null, null, null, 'DEPOSIT REQUEST (S$)', 1548],
];

describe('reading an old invoice', () => {
  it('keeps every line as invoiced, with the header details', () => {
    const old = parseOldInvoice(template);
    assert.equal(old.number, 'MXN-HX-26090101');
    assert.equal(old.date, '2026-09-01');
    assert.deepEqual(old.client, { name: 'Mr Tan', contact: '91234567' });
    assert.deepEqual(
      old.rows.map((r) => (r.kind === 'item' ? [r.quantity, r.unitPrice] : r.title)),
      [[1, 1390], [2, 100], 'Lighting', [15, 78], [1, 988], [15, -12]],
    );
    assert.equal(old.total, 2580);
    assert.equal(old.deposit, 1548);
    assert.deepEqual(issuedFromOld(old).deposit?.due, 1548);
  });

  it('picks up what a 2nd payment invoice asked for', () => {
    const second = [
      ...template.slice(0, -1),
      [null, null, null, null, 'LESS PAID (S$)', 1548],
      [null, null, null, null, '2ND PAYMENT (S$)', 774],
    ];
    const issued = issuedFromOld(parseOldInvoice(second));
    assert.equal(issued.deposit?.due, 1548);
    assert.equal(issued.second?.due, 774);
  });

  it('takes the client from Attn, not the sales person under Prepared by', () => {
    const old = parseOldInvoice([
      // Read off a scan, the headings can come out in a row of their own.
      ['TO', 'Attn:'],
      ...template.slice(0, 5),
      ['Attn:', 'Ting', null, null, null, null],
      ...template.slice(6),
      ['Prepared by:', null, null, null, null, null],
      ['Name: Cheang He Xiang', null, null, null, null, null],
    ]);
    assert.equal(old.client.name, 'Ting');
  });

  it('restores a deposit whose leading digits a narrow column cut off', () => {
    const cut = (deposit: number) =>
      parseOldInvoice([
        ...template.slice(0, -2),
        [null, null, null, null, 'GRANT TOTAL (S$)', 4830],
        [null, null, null, null, 'DEPOSIT REQUEST (S$', deposit],
      ]).deposit;
    // "898.00" printed for S$2,898.00, 60% of S$4,830.
    assert.equal(cut(898), 2898);
    // A whole percentage is kept as printed.
    assert.equal(cut(2415), 2415);
  });

  it('reads rows pasted from a spreadsheet without headings', () => {
    const old = parseOldInvoice([
      ['1', 'Nova Package', '1', '1,990.00'],
      ['2', 'Smart Curtain Track, Single', '2', 'S$380'],
    ]);
    assert.deepEqual(
      old.rows.map((r) => (r.kind === 'item' ? [r.description, r.quantity, r.unitPrice] : null)),
      [
        ['Nova Package', 1, 1990],
        ['Smart Curtain Track, Single', 2, 380],
      ],
    );
  });
});

describe('electrical rates', () => {
  it('sit within their market range, with unique ids', () => {
    const items = ELECTRICAL_RATES.flatMap((s) => s.items);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
    for (const i of items) assert.ok(i.low <= i.rate && i.rate <= i.high, i.id);
    const socket = items.find((i) => i.id === 'socket-single')!;
    assert.equal(socket.rate, 75);
  });
});
