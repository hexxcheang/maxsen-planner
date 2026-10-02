import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { alignPoint } from '../src/geometry/align.ts';

describe('alignPoint', () => {
  it('lines up with a nearby light across or down, and leaves a far one alone', () => {
    const r = alignPoint({ x: 203, y: 97 }, [{ x: 100, y: 100 }], 6);
    assert.deepEqual(r.at, { x: 203, y: 100 });
    assert.equal(r.guides.length, 1);
    assert.deepEqual(r.guides[0], {
      kind: 'line',
      from: { x: 100, y: 100 },
      to: { x: 203, y: 100 },
    });
    const free = alignPoint({ x: 203, y: 120 }, [{ x: 100, y: 100 }], 6);
    assert.deepEqual(free.at, { x: 203, y: 120 });
    assert.equal(free.guides.length, 0);
  });

  it('snaps both ways at once into a grid corner', () => {
    const r = alignPoint(
      { x: 198, y: 204 },
      [
        { x: 200, y: 100 },
        { x: 100, y: 200 },
      ],
      6,
    );
    assert.deepEqual(r.at, { x: 200, y: 200 });
  });

  it('continues an evenly spaced row, one step on, and marks the equal gaps', () => {
    const row = [
      { x: 100, y: 100 },
      { x: 160, y: 100 },
    ];
    const r = alignPoint({ x: 223, y: 102 }, row, 6);
    assert.deepEqual(r.at, { x: 220, y: 100 });
    const gaps = r.guides.filter((g) => g.kind === 'gap');
    assert.equal(gaps.length, 2);
  });

  it('snaps halfway between two lights in a line', () => {
    const r = alignPoint(
      { x: 104, y: 148 },
      [
        { x: 100, y: 100 },
        { x: 100, y: 200 },
      ],
      6,
    );
    assert.deepEqual(r.at, { x: 100, y: 150 });
  });

  it('needs two lights in the line before it looks for even spacing', () => {
    // With one light in the row, only the row itself pulls; x stays where the pointer is.
    const r = alignPoint({ x: 157, y: 101 }, [{ x: 100, y: 100 }], 6);
    assert.deepEqual(r.at, { x: 157, y: 100 });
  });
});
