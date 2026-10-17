import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_SHAPES, iconPath, isPathShape, type IconShape } from '../src/icons.ts';
import { CATEGORIES } from '../src/categories.ts';

/** Coordinates of a path authored with absolute commands only; arc rotation and flags are skipped. */
const coordinatesIn = (d: string): number[] => {
  const out: number[] = [];
  for (const m of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const cmd = m[1] ?? '';
    assert.match(cmd, /^[A-Z]$/, `relative command ${cmd} in ${d}`);
    const nums = (m[2]?.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (cmd === 'A') {
      for (let i = 0; i + 6 < nums.length; i += 7) {
        out.push(nums[i] ?? 0, nums[i + 1] ?? 0, nums[i + 5] ?? 0, nums[i + 6] ?? 0);
      }
    } else {
      out.push(...nums);
    }
  }
  return out;
};

describe('iconPath', () => {
  it('every shape returns a non-empty path starting with M', () => {
    assert.equal(ICON_SHAPES.length, 20);
    for (const shape of ICON_SHAPES) {
      const d = iconPath(shape);
      assert.ok(d.length > 0, `${shape} empty`);
      assert.ok(d.startsWith('M'), `${shape} does not start with M: ${d}`);
    }
  });

  it('point shapes stay inside the unit box', () => {
    for (const shape of ICON_SHAPES) {
      if (isPathShape(shape)) continue;
      for (const n of coordinatesIn(iconPath(shape))) {
        assert.ok(Math.abs(n) <= 0.5 + 1e-6, `${shape} has coordinate ${n} outside the unit box`);
      }
    }
  });

  it('isPathShape true only for track, strip, magnetic, curtain', () => {
    const pathShapes = ICON_SHAPES.filter(isPathShape);
    assert.deepEqual([...pathShapes].sort(), ['curtain', 'magnetic', 'strip', 'track']);
  });

  it('every category shape is a known icon shape and path categories use path shapes', () => {
    for (const c of CATEGORIES) {
      assert.ok(ICON_SHAPES.includes(c.shape), `${c.id} shape ${c.shape}`);
      assert.equal(isPathShape(c.shape), c.kind !== 'point', `${c.id} shape kind`);
    }
  });

  it('throws on an unknown shape', () => {
    assert.throws(() => iconPath('blob' as IconShape), /Unknown icon shape/);
  });
});

describe('badgePlacement', () => {
  it('returns a centre inside the unit box and a scale in (0, 1] for every shape', async () => {
    const { badgePlacement } = await import('../src/icons.ts');
    for (const shape of ICON_SHAPES) {
      const p = badgePlacement(shape);
      assert.ok(Math.abs(p.x) <= 0.5 && Math.abs(p.y) <= 0.5, `${shape} centre`);
      assert.ok(p.scale > 0 && p.scale <= 1, `${shape} scale`);
    }
  });

  it('lowers the badge on the triangle and raises it into the camera dome', async () => {
    const { badgePlacement } = await import('../src/icons.ts');
    assert.ok(badgePlacement('triangle').y > 0.05, 'triangle badge sits in the wide lower half');
    assert.ok(badgePlacement('dome').y < 0, 'dome badge sits inside the dome');
    assert.deepEqual(badgePlacement('square'), { x: 0, y: 0, scale: 1 });
  });
});
