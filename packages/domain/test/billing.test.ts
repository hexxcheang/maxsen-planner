import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRICING, exportFilename, stageAmounts, withFullPayment } from '../src/index.ts';

const pricing = { depositPercent: 60, secondPercent: 30 };

describe('invoice payment stages', () => {
  it('asks for the deposit on the first invoice', () => {
    const a = stageAmounts(10000, pricing, undefined);
    assert.deepEqual([a.stage, a.paid, a.due], ['deposit', 0, 6000]);
  });

  it('suggests the deposit invoiced as paid when items were added since', () => {
    const billing = {
      stage: 'second' as const,
      issued: { deposit: { number: 'D1', total: 10000, due: 6000, date: '' } },
    };
    // The total grew to 12,000: 90% is 10,800, less the 6,000 deposit.
    const a = stageAmounts(12000, pricing, billing);
    assert.deepEqual([a.suggestedPaid, a.paid, a.due], [6000, 6000, 4800]);
    assert.match(a.suggestedFrom, /D1/);
  });

  it('uses what was actually collected when changed', () => {
    const a = stageAmounts(12000, pricing, { stage: 'second', paid: { second: 5000 } });
    assert.deepEqual([a.suggestedPaid, a.paid, a.due], [7200, 5000, 5800]);
  });

  it('suggests deposit + 2nd payment for the final invoice and asks for the balance', () => {
    const billing = {
      stage: 'final' as const,
      issued: {
        deposit: { number: 'D1', total: 10000, due: 6000, date: '' },
        second: { number: 'D2', total: 12000, due: 4800, date: '' },
      },
    };
    const a = stageAmounts(12500, pricing, billing);
    assert.deepEqual([a.suggestedPaid, a.due], [10800, 1700]);
    assert.deepEqual(stageAmounts(12500, pricing, { ...billing, paid: { final: 12000 } }).due, 500);
  });

  it('names the later invoices after their payment', () => {
    assert.equal(exportFilename('Tan', 'invoice', 'second'), 'Tan - 2nd Payment Invoice.xlsx');
    assert.equal(exportFilename('Tan', 'invoice', 'final'), 'Tan - Final Invoice.xlsx');
    assert.equal(exportFilename('Tan', 'invoice'), 'Tan - Invoice.xlsx');
    assert.equal(exportFilename('Tan', 'invoice-pdf'), 'Tan - Invoice.pdf');
    assert.equal(exportFilename('Tan', 'invoice-pdf', 'final'), 'Tan - Final Invoice.pdf');
  });

  it('asks for the whole total at once for full payment', () => {
    const a = stageAmounts(10000, pricing, { stage: 'full', paid: { full: 500 } });
    assert.deepEqual([a.stage, a.percent, a.paid, a.due], ['full', 100, 0, 10000]);
    assert.equal(exportFilename('Tan', 'invoice-pdf', 'full'), 'Tan - Full Payment Invoice.pdf');
  });

  it('words the terms for full payment, without the 2nd and last payments', () => {
    const terms = withFullPayment(DEFAULT_PRICING).terms;
    assert.match(terms, /commence after receiving full payment \(100%\)\./);
    assert.doesNotMatch(terms, /Next,|Last,|Then,|deposit/i);
    assert.match(terms, /Payment Terms: Grant Total in the final invoice/);
  });
});
