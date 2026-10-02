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

describe('findWindows on a brochure-style plan', () => {
  // An 800×600 plan drawn the HDB way: solid 12 px walls and columns, glazing as two soft grey
  // lines between the façade columns, thin double-line walls inside, a balcony with glazed doors
  // behind its railing, and a dimension line outside.
  const W = 800;
  const H = 600;
  const data = new Uint8Array(W * H).fill(252);
  const fill = (x0: number, y0: number, x1: number, y1: number, lum: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * W + x] = lum;
  };
  const hLine = (x0: number, x1: number, y: number) => fill(x0, y, x1, y + 2, 120);
  const vLine = (y0: number, y1: number, x: number) => fill(x, y0, x + 2, y1, 120);
  // Façade: solid left and bottom walls, columns along the top and right.
  fill(100, 100, 112, 500, 20);
  fill(100, 488, 700, 500, 20);
  for (const x of [100, 380, 670]) fill(x, 100, x + 30, 130, 20);
  fill(688, 100, 700, 250, 20);
  fill(688, 420, 700, 500, 20);
  // Glazing between the columns: the balcony railing (130–380), Bedroom's window (410–670), and
  // a window on the right wall (250–420).
  for (const [a, b] of [
    [130, 380],
    [410, 670],
  ] as const) {
    hLine(a, b, 102);
    hLine(a, b, 109);
  }
  vLine(250, 420, 690);
  vLine(250, 420, 697);
  // Glazed doors from the living room onto the balcony.
  hLine(112, 380, 196);
  hLine(112, 380, 204);
  // Thin double-line walls inside: between balcony/living and the bedroom, and along a corridor.
  vLine(130, 300, 395);
  vLine(130, 300, 403);
  hLine(112, 688, 300);
  hLine(112, 688, 308);
  // A dimension line above the plan, with ticks.
  hLine(100, 700, 60);
  for (const x of [100, 380, 700]) vLine(52, 68, x);
  const image: GrayImage = { width: W, height: H, data };

  it('finds the glazing on the outside, and the balcony doors behind the railing', async () => {
    const { findWindows } = await import('../src/magic/vision/windows.ts');
    const found = findWindows(image).map((f) => ({
      x: ((f.x1 + f.x2) / 2) * W,
      y: ((f.y1 + f.y2) / 2) * H,
      horizontal: Math.abs(f.y1 - f.y2) < 1e-9,
    }));
    const near = (x: number, y: number) =>
      found.some((f) => Math.abs(f.x - x) < 20 && Math.abs(f.y - y) < 10);
    assert.ok(near(255, 106), 'balcony railing');
    assert.ok(near(540, 106), 'bedroom window');
    assert.ok(near(694, 335), 'window on the right wall');
    assert.ok(near(246, 200), 'balcony doors');
    // Not the walls inside the home.
    assert.ok(!found.some((f) => f.horizontal && Math.abs(f.y - 304) < 10), 'corridor wall');
    assert.ok(!found.some((f) => !f.horizontal && Math.abs(f.x - 399) < 10), 'bedroom wall');
    assert.equal(found.length, 4);
  });

  it('reads glazing that has blurred into one grey band', async () => {
    const { findWindows } = await import('../src/magic/vision/windows.ts');
    const blurred = Uint8Array.from(data);
    // Merge the right-wall window's two lines into one band, as a low-resolution scan does.
    for (let y = 250; y < 420; y++) for (let x = 689; x < 700; x++) blurred[y * W + x] = 130;
    const found = findWindows({ width: W, height: H, data: blurred });
    assert.ok(
      found.some(
        (f) => Math.abs(f.x1 * W - 694) < 8 && Math.abs(((f.y1 + f.y2) / 2) * H - 335) < 20,
      ),
    );
  });

  it('reads the window marked with an X on its line, out to its columns', async () => {
    const { windowReader } = await import('../src/magic/vision/windows.ts');
    const read = windowReader(image);
    const px = (f: { x1: number; y1: number; x2: number; y2: number } | null) =>
      f && [f.x1 * W, f.y1 * H, f.x2 * W, f.y2 * H].map(Math.round);
    // A mark a little off the line still finds it; the window ends at the columns either side.
    const top = px(read(540 / W, 112 / H))!;
    assert.ok(Math.abs(top[0]! - 410) <= 3 && Math.abs(top[2]! - 670) <= 3, top.join());
    assert.ok(Math.abs(top[1]! - 106) <= 4 && top[1] === top[3]);
    const right = px(read(700 / W, 300 / H))!;
    assert.ok(right[0] === right[2] && Math.abs(right[0]! - 694) <= 4, right.join());
    assert.ok(Math.abs(right[1]! - 250) <= 3 && Math.abs(right[3]! - 420) <= 3, right.join());
    // Nothing near the mark: no window.
    assert.equal(read(250 / W, 420 / H), null);
  });
});
