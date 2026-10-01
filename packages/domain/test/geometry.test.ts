import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { boundsOf, dist, lerp, rotateAround } from '../src/geometry/points.ts';
import { catmullRomToBezier } from '../src/geometry/catmull-rom.ts';
import {
  circlePoints,
  distanceToPath,
  headPositions,
  pathLength,
  pathMidpoint,
  pointAtLength,
  polylineToSvgPath,
  samplePath,
  smoothToSvgPath,
} from '../src/geometry/path.ts';
import type { Pt } from '../src/types.ts';

const L: Pt[] = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 4 },
];

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

describe('points', () => {
  it('dist, lerp and boundsOf', () => {
    assert.equal(dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
    assert.deepEqual(lerp({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.25), { x: 2.5, y: 5 });
    assert.deepEqual(boundsOf(L), { x: 0, y: 0, w: 3, h: 4 });
  });

  it('rotateAround 90° maps (1,0) around origin to (0,1)', () => {
    const p = rotateAround({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    close(p.x, 0);
    close(p.y, 1);
  });
});

describe('pathLength', () => {
  it('of (0,0)(3,0)(3,4) is 7 open and 12 closed', () => {
    assert.equal(pathLength(L, false), 7);
    assert.equal(pathLength(L, true), 12);
  });

  it('is 0 for fewer than two points', () => {
    assert.equal(pathLength([{ x: 1, y: 1 }], false), 0);
    assert.equal(pathLength([], true), 0);
  });
});

describe('pointAtLength', () => {
  it('at 5 on the L path is (3,2) with angle 90', () => {
    const r = pointAtLength(L, false, 5);
    close(r.point.x, 3);
    close(r.point.y, 2);
    close(r.angle, 90);
  });

  it('clamps beyond the ends', () => {
    assert.deepEqual(pointAtLength(L, false, -2).point, { x: 0, y: 0 });
    assert.deepEqual(pointAtLength(L, false, 99).point, { x: 3, y: 4 });
  });

  it('pathMidpoint is at half the length', () => {
    const m = pathMidpoint(L, false);
    close(m.point.x, 3);
    close(m.point.y, 0.5);
  });
});

describe('headPositions', () => {
  it('3 heads on (0,0)→(6,0) are at x = 1, 3, 5', () => {
    const heads = headPositions(
      [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
      3,
    );
    assert.deepEqual(
      heads.map((h) => h.point.x),
      [1, 3, 5],
    );
    assert.ok(heads.every((h) => h.angle === 0));
  });

  it('1 head is the midpoint', () => {
    const [h] = headPositions(L, 1);
    assert.ok(h);
    close(h.point.x, 3);
    close(h.point.y, 0.5);
  });

  it('0 heads gives no positions', () => {
    assert.deepEqual(headPositions(L, 0), []);
  });
});

describe('svg paths', () => {
  it('polylineToSvgPath formats M/L and Z', () => {
    assert.equal(polylineToSvgPath(L, false), 'M0 0 L3 0 L3 4');
    assert.equal(polylineToSvgPath(L, true), 'M0 0 L3 0 L3 4 Z');
  });

  it('smoothToSvgPath of 2 points degrades to a straight C segment', () => {
    const d = smoothToSvgPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      false,
    );
    assert.match(d, /^M0 0 C/);
    const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    // every control point lies on y = 0 → straight line
    for (let i = 1; i < nums.length; i += 2) close(nums[i] ?? NaN, 0);
  });

  it('catmullRomToBezier wraps around for closed paths', () => {
    const segs = catmullRomToBezier(circlePoints({ x: 0, y: 0 }, 10, 4), true);
    assert.equal(segs.length, 4);
    const open = catmullRomToBezier(circlePoints({ x: 0, y: 0 }, 10, 4), false);
    assert.equal(open.length, 3);
  });
});

describe('circlePoints and sampling', () => {
  it('circlePoints(center (100,100), r 50) returns 8 points each 50 from centre', () => {
    const pts = circlePoints({ x: 100, y: 100 }, 50);
    assert.equal(pts.length, 8);
    for (const p of pts) close(dist(p, { x: 100, y: 100 }), 50, 1e-9);
  });

  it('a closed smooth path through 8 circle points approximates the circumference within 1%', () => {
    const pts = circlePoints({ x: 0, y: 0 }, 50);
    const sampled = samplePath(pts, { closed: true, smooth: true });
    const len = pathLength(sampled, true);
    const circumference = 2 * Math.PI * 50;
    assert.ok(Math.abs(len - circumference) / circumference < 0.01, `len ${len} vs ${circumference}`);
  });

  it('samplePath of a straight polyline returns the same points', () => {
    assert.deepEqual(samplePath(L, { closed: false, smooth: false }), L);
  });
});

describe('distanceToPath', () => {
  it('from (1.5,1) to segment (0,0)-(3,0) is 1', () => {
    assert.equal(
      distanceToPath(
        { x: 1.5, y: 1 },
        [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
        ],
        { closed: false, smooth: false },
      ),
      1,
    );
  });

  it('uses the closing segment when closed', () => {
    const square: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const p = { x: -2, y: 5 };
    assert.equal(distanceToPath(p, square, { closed: false, smooth: false }), Math.hypot(2, 5));
    assert.equal(distanceToPath(p, square, { closed: true, smooth: false }), 2);
  });
});
