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
import { FloorReadError, readFloorPlan } from '../src/magic/vision/read-floor-plan.ts';
import { SAMPLE_DRAWINGS, hdb4room, type Drawing } from '../src/sample/drawings.ts';
import { analyseSampleDrawing } from '../src/sample/analyses.ts';
import { magicPlan, MAGIC_CATEGORIES } from '../src/magic/magic-plan.ts';
import type { AnalysisRoom, FloorAnalysis } from '../src/magic/analysis.ts';
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

const iou = (a: AnalysisRoom, b: AnalysisRoom) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter);
};
const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
  Math.abs(p.x - q.x) < 0.012 && Math.abs(p.y - q.y) < 0.012;

/** Pairs each expected room with the detected room that overlaps it best. */
function matchRooms(found: FloorAnalysis, expected: FloorAnalysis) {
  const map = new Map<string, string>();
  for (const e of expected.rooms) {
    const best = found.rooms
      .map((f) => ({ f, score: iou(f, e) }))
      .sort((a, b) => b.score - a.score)[0];
    assert.ok(
      best && best.score > 0.8,
      `room ${e.name} not found (best IoU ${best?.score.toFixed(2)})`,
    );
    map.set(e.id, best.f.id);
  }
  return map;
}

function read(d: Drawing, scale = 1) {
  return readFloorPlan(rasterize(d, scale).image);
}

/** Windows on an outside wall of the sample (nothing drawn beyond them). */
function outsideWindows(d: Drawing, expected: FloorAnalysis) {
  const inAnyRoom = (x: number, y: number) =>
    d.rooms.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  return expected.windows.filter((e) => {
    const mx = ((e.start.x + e.end.x) / 2) * 1400;
    const my = ((e.start.y + e.end.y) / 2) * 1000;
    const horizontal = e.start.y === e.end.y;
    return horizontal
      ? !inAnyRoom(mx, my - 15) || !inAnyRoom(mx, my + 15)
      : !inAnyRoom(mx - 15, my) || !inAnyRoom(mx + 15, my);
  });
}

describe('readFloorPlan on the sample drawings', () => {
  for (const d of SAMPLE_DRAWINGS) {
    describe(d.title, () => {
      const expected = analyseSampleDrawing(d);
      const { analysis, issues } = read(d);
      const rooms = matchRooms(analysis, expected);
      const mapped = (id: string | null) => (id === null ? null : rooms.get(id)!);

      it('finds every room, numbered rather than named or classified', () => {
        assert.equal(analysis.rooms.length, expected.rooms.length);
        assert.equal(rooms.size, expected.rooms.length);
        assert.ok(analysis.rooms.every((r, i) => r.type === 'other' && r.name === `Room ${i + 1}`));
      });

      it('finds the opening of every door and the rooms it joins', () => {
        assert.equal(analysis.doors.length, expected.doors.length);
        for (const e of expected.doors) {
          const f = analysis.doors.find(
            (x) =>
              (near(x.hinge, e.hinge) && near(x.latch, e.latch)) ||
              (near(x.hinge, e.latch) && near(x.latch, e.hinge)),
          );
          assert.ok(f, `door at ${JSON.stringify(e.hinge)} not found`);
          assert.deepEqual([...f.sides].sort(), e.sides.map(mapped).sort());
        }
      });

      it('takes a door to the outside as the main entrance', () => {
        const entrance = analysis.doors.filter((x) => x.isMainEntrance);
        assert.ok(entrance.length <= 1);
        if (entrance[0]) assert.ok(entrance[0].sides.includes(null));
        const front = expected.doors.find((x) => x.isMainEntrance && x.sides.includes(null));
        if (front) assert.equal(entrance.length, 1);
      });

      it('finds every window on an outside wall and the room it lights', () => {
        const outside = outsideWindows(d, expected);
        assert.equal(analysis.windows.length, outside.length);
        for (const e of outside) {
          const f = analysis.windows.find(
            (x) =>
              (near(x.start, e.start) && near(x.end, e.end)) ||
              (near(x.start, e.end) && near(x.end, e.start)),
          );
          assert.ok(f, `window at ${JSON.stringify(e.start)} not found`);
          assert.equal(f.roomId, mapped(e.roomId));
        }
      });

      it('estimates the scale from the doors', () => {
        assert.ok(analysis.imageWidthMetres! > 12 && analysis.imageWidthMetres! < 17);
      });

      it('raises no issues on a clean drawing', () => {
        assert.deepEqual(issues, []);
      });
    });
  }

  it('reads the same plan at other resolutions', () => {
    for (const scale of [0.75, 1.4]) {
      const { analysis } = read(hdb4room, scale);
      const expected = analyseSampleDrawing(hdb4room);
      matchRooms(analysis, expected);
      assert.equal(analysis.doors.length, expected.doors.length, `scale ${scale}`);
      assert.equal(
        analysis.windows.length,
        outsideWindows(hdb4room, expected).length,
        `scale ${scale}`,
      );
    }
  });

  it('gives Magic Plan enough to place switches and lights', () => {
    const { analysis } = read(hdb4room);
    const result = magicPlan({
      analysis,
      sheet: { width: 1000, height: 1000 / 1.4 },
      categories: MAGIC_CATEGORIES.map((c) => c.id),
      pick: (categoryId) => categoryId,
    });
    assert.ok(result.placements.filter((p) => p.categoryId === 'smart-switches').length >= 8);
    assert.ok(result.placements.filter((p) => p.categoryId === 'downlights').length >= 10);
    // Unnamed rooms are planned by size and shape: every room gets light, big rooms a fan.
    const lightCats = ['downlights', 'surface-lights', 'track-lights', 'ceiling-fans'];
    for (const room of analysis.rooms) {
      assert.ok(
        result.placements.some((p) => p.roomId === room.id && lightCats.includes(p.categoryId)),
        `${room.name} has no light`,
      );
    }
    assert.ok(result.placements.filter((p) => p.categoryId === 'ceiling-fans').length >= 3);
    // The room names stay as read: nothing is labelled as a bedroom or bathroom.
    assert.ok(analysis.rooms.every((r) => r.type === 'other'));
  });

  it('explains when a page has no rooms on it', () => {
    const blank: GrayImage = { width: 200, height: 100, data: new Uint8Array(20000).fill(255) };
    assert.throws(() => readFloorPlan(blank), FloorReadError);
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
