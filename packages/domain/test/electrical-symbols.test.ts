import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ELECTRICAL_RATES } from '../src/electrical/rates.ts';
import {
  countSymbols,
  ELECTRICAL_SYMBOLS,
  plottedRates,
  type ElectricalPoint,
} from '../src/electrical/symbols.ts';

const at = (symbol: string, i: number): ElectricalPoint => ({ id: `p${i}`, symbol, x: i, y: i });

describe('electrical plan symbols', () => {
  it('ties every priced symbol to a rate that exists', () => {
    const rates = new Set(ELECTRICAL_RATES.flatMap((s) => s.items.map((i) => i.id)));
    for (const s of ELECTRICAL_SYMBOLS) if (s.rateId) assert.ok(rates.has(s.rateId), s.id);
    assert.equal(new Set(ELECTRICAL_SYMBOLS.map((s) => s.id)).size, ELECTRICAL_SYMBOLS.length);
  });

  it('counts plotted points by symbol, and by rate for the quotation', () => {
    const points = [
      at('light', 1),
      at('light', 2),
      at('socket-twin', 3),
      at('switch-2', 4),
      at('switch-2way', 5),
    ];
    assert.deepEqual(countSymbols(points), {
      light: 2,
      'socket-twin': 1,
      'switch-2': 1,
      'switch-2way': 1,
    });
    // Switches are on the drawing only (a lighting point's rate includes its switch), except
    // 2-way switching, which has its own rate.
    assert.deepEqual(plottedRates(points), {
      'light-point': 2,
      'socket-twin': 1,
      'two-way': 1,
    });
  });
});
