import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  components,
  dominantRunLength,
  open,
  otsuThreshold,
  toGray,
  type GrayImage,
} from '../src/magic/vision/image.ts';
import { hdb4room } from '../src/sample/drawings.ts';
import { suggestCrop } from '../src/magic/vision/crop.ts';
import { rasterize } from './helpers/raster.ts';

describe('image primitives', () => {
  it('splits paper from ink with Otsu', () => {
    const data = new Uint8Array(100).fill(250);
    data.fill(20, 0, 30);
    const t = otsuThreshold({ width: 10, height: 10, data });
    assert.ok(t >= 20 && t < 250);
  });

  it('opening keeps thick strokes and drops thin ones', () => {
    const w = 20;
    const mask = new Uint8Array(w * w);
    for (let y = 2; y < 8; y++) for (let x = 2; x < 18; x++) mask[y * w + x] = 1; // 6 px bar
    for (let x = 2; x < 18; x++) mask[14 * w + x] = 1; // 1 px line
    const out = open(mask, w, w, 4);
    assert.equal(out[5 * w + 10], 1);
    assert.equal(out[14 * w + 10], 0);
  });

  it('labels connected regions', () => {
    const w = 6;
    const mask = new Uint8Array([
      1,
      1,
      0,
      0,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      ...new Array<number>(24).fill(0),
    ]);
    const { stats } = components(mask, w, 6, 1);
    assert.equal(stats.length, 2);
    assert.deepEqual(
      stats.map((c) => c.area),
      [4, 4],
    );
  });

  it('finds the most common stroke width', () => {
    const w = 40;
    const mask = new Uint8Array(w * w);
    for (let y = 0; y < 40; y++) for (let x = 10; x < 18; x++) mask[y * w + x] = 1;
    assert.equal(dominantRunLength(mask, w, w, 4, 30), 8);
  });

  it('reads transparent pixels as paper', () => {
    const img = toGray(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]), 2, 1);
    assert.deepEqual([...img.data], [255, 0]);
  });
});

describe('suggestCrop', () => {
  it('crops a sample page to the plan, leaving out the title block', () => {
    const { image } = rasterize(hdb4room);
    const c = suggestCrop(image);
    // Building walls run 100–1300 × 100–900 on a 1400 × 1000 page.
    assert.ok(c.x > 0.02 && c.x < 0.071, `x ${c.x}`);
    assert.ok(c.y > 0.02 && c.y < 0.1, `y ${c.y}`);
    assert.ok(c.x + c.w > 0.929 && c.x + c.w < 0.98, `right ${c.x + c.w}`);
    assert.ok(c.y + c.h > 0.9 && c.y + c.h < 0.95, `bottom ${c.y + c.h}`);
  });

  it('leaves a blank page alone', () => {
    const blank: GrayImage = { width: 200, height: 100, data: new Uint8Array(20000).fill(255) };
    assert.deepEqual(suggestCrop(blank), { x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('findWindows', () => {
  it('finds the glazed breaks in the outer walls of a sample drawing', async () => {
    const { findWindows } = await import('../src/magic/vision/windows.ts');
    const { image } = rasterize(hdb4room);
    const found = findWindows(image);
    assert.equal(found.length, hdb4room.windows.length);
    for (const w of hdb4room.windows) {
      const hit = found.some(
        (f) =>
          Math.abs((f.x1 + f.x2) / 2 - (w.x1 + w.x2) / 2 / 1400) < 0.02 &&
          Math.abs((f.y1 + f.y2) / 2 - (w.y1 + w.y2) / 2 / 1000) < 0.02,
      );
      assert.ok(hit, `window ${JSON.stringify(w)}`);
    }
  });
});
