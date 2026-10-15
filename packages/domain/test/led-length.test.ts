import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateLedMetres, ledMetres, runLengthUnits, scaleFromLine } from '../src/led-length.ts';
import type { LedStripPath } from '../src/types.ts';

const run = (points: [number, number][], extra: Partial<LedStripPath> = {}): LedStripPath => ({
  kind: 'led-strip',
  id: 'l1',
  z: 0,
  variantId: 'led1',
  points: points.map(([x, y]) => ({ x, y })),
  closed: false,
  smooth: false,
  metres: null,
  showLabel: false,
  ...extra,
});

describe('LED strip lengths', () => {
  const scale = { unitsPerMetre: 50, from: 'measured' as const };

  it('follows every bend of the run', () => {
    // An L along two walls: 3 m then 2 m.
    const l = run([
      [0, 0],
      [150, 0],
      [150, 100],
    ]);
    assert.equal(runLengthUnits(l), 250);
    assert.equal(estimateLedMetres(l, scale), 5);
  });

  it('goes all the way round a closed loop', () => {
    const box = run(
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      { closed: true },
    );
    assert.equal(estimateLedMetres(box, scale), 8);
  });

  it('rounds up to the next half metre, but not for drawing wobble', () => {
    assert.equal(
      estimateLedMetres(
        run([
          [0, 0],
          [110, 0],
        ]),
        scale,
      ),
      2.5,
    ); // 2.2 m
    assert.equal(
      estimateLedMetres(
        run([
          [0, 0],
          [100.4, 0],
        ]),
        scale,
      ),
      2,
    ); // 2.008 m
    assert.equal(
      estimateLedMetres(
        run([
          [0, 0],
          [5, 0],
        ]),
        scale,
      ),
      0.5,
    );
  });

  it('measures a smooth curve along the curve', () => {
    const pts: [number, number][] = [
      [0, 0],
      [100, 100],
      [200, 0],
    ];
    assert.ok(runLengthUnits(run(pts, { smooth: true })) >= runLengthUnits(run(pts)) - 1);
  });

  it('uses a typed length first, and has none without a scale', () => {
    const l = run([
      [0, 0],
      [100, 0],
    ]);
    assert.deepEqual(ledMetres(l, scale), { metres: 2, estimated: true });
    assert.deepEqual(ledMetres({ ...l, metres: 3.2 }, scale), { metres: 3.2, estimated: false });
    assert.equal(ledMetres(l, undefined), null);
  });

  it('sets the scale from a line of known length', () => {
    assert.equal(scaleFromLine(300, 6), 50);
    assert.equal(scaleFromLine(300, 0), null);
  });
});
