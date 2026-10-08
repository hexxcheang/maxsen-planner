import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkouts, discrepancies, stockLevels, type Movement } from '../src/inventory.ts';

const mv = (m: Partial<Movement> & Pick<Movement, 'kind' | 'lines' | 'at'>): Movement => ({
  id: m.at,
  by: 'x',
  ...m,
});
const sw = (qty: number) => ({ variantId: 'var_sw', name: 'Nova+ Pro, 2-gang', qty });
const dl = (qty: number) => ({ variantId: 'var_dl', name: 'Luna Downlight', qty });

describe('inventory', () => {
  const movements = [
    mv({ kind: 'restock', at: '1', lines: [sw(20), dl(50)] }),
    // Taken out for a site: written 10 switches; the manager counted 12.
    mv({
      kind: 'checkout',
      at: '2',
      site: 'Tan residence',
      lines: [sw(10), dl(15)],
      verified: { by: 'Boss', at: '3', counts: { var_sw: 12, var_dl: 15 } },
    }),
    // Another take-out, not checked yet.
    mv({ kind: 'checkout', at: '4', site: 'Lim home', lines: [dl(10)] }),
    mv({ kind: 'return', at: '5', site: 'Tan residence', lines: [dl(2)] }),
    mv({ kind: 'adjust', at: '6', lines: [sw(-1)] }),
  ];

  it('adds up restocks, take-outs (as counted), returns and corrections', () => {
    const levels = stockLevels({ movements, minimums: { var_sw: 8 } });
    assert.deepEqual(
      levels.map((l) => [l.variantId, l.inStock, l.pending, l.low]),
      [
        ['var_dl', 50 - 15 - 10 + 2, 10, false],
        // 20 − 12 counted − 1 lost = 7: at or below 8, so low.
        ['var_sw', 7, 0, true],
      ],
    );
  });

  it('lists take-outs to check first, and shows what the check changed', () => {
    const list = checkouts({ movements, minimums: {} });
    assert.deepEqual(
      list.map((m) => m.site),
      ['Lim home', 'Tan residence'],
    );
    assert.deepEqual([...discrepancies(list[1]!)], [['var_sw', [10, 12]]]);
  });
});
