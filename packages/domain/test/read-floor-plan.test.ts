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
import { cropLabel, rotateLabel } from '../src/magic/vision/labels.ts';
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

function read(d: Drawing, scale = 1, withLabels = true) {
  const { image, labels } = rasterize(d, scale);
  return readFloorPlan(image, { labels: withLabels ? labels : [] });
}

describe('readFloorPlan on the sample drawings', () => {
  for (const d of SAMPLE_DRAWINGS) {
    describe(d.title, () => {
      const expected = analyseSampleDrawing(d);
      const { analysis, issues } = read(d);
      const rooms = matchRooms(analysis, expected);
      const mapped = (id: string | null) => (id === null ? null : rooms.get(id)!);

      it('finds every room, named and typed from its label', () => {
        assert.equal(analysis.rooms.length, expected.rooms.length);
        for (const e of expected.rooms) {
          const f = analysis.rooms.find((r) => r.id === rooms.get(e.id))!;
          assert.equal(f.type, e.type, `${e.name}: ${f.type}`);
          assert.ok(f.name.startsWith(e.name), `${e.name} read as ${f.name}`);
        }
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
          assert.equal(f.isMainEntrance, e.isMainEntrance);
        }
      });

      it('finds every window and the room it lights', () => {
        assert.equal(analysis.windows.length, expected.windows.length);
        for (const e of expected.windows) {
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

      it('only raises issues for what the drawing leaves out', () => {
        const unnamed = expected.rooms.filter(
          (r) => !d.rooms[Number(r.id.slice(1)) - 1]!.label,
        ).length;
        assert.equal(issues.length, unnamed > 0 ? 1 : 0, issues.join('; '));
      });
    });
  }

  it('reads the same plan at other resolutions', () => {
    for (const scale of [0.75, 1.4]) {
      const { analysis } = read(hdb4room, scale);
      const expected = analyseSampleDrawing(hdb4room);
      matchRooms(analysis, expected);
      assert.equal(analysis.doors.length, expected.doors.length, `scale ${scale}`);
      assert.equal(analysis.windows.length, expected.windows.length, `scale ${scale}`);
    }
  });

  it('names rooms by size and shape when the drawing has no labels', () => {
    const { analysis, issues } = read(hdb4room, 1, false);
    const types = analysis.rooms.map((r) => r.type);
    assert.equal(types.filter((t) => t === 'living-dining').length, 1);
    assert.equal(types.filter((t) => t === 'master-bedroom').length, 1);
    assert.ok(types.includes('bathroom'));
    assert.ok(types.includes('corridor'));
    assert.ok(analysis.rooms.every((r) => r.name.length > 0));
    assert.match(issues.join(' '), /10 rooms had no name/);
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
  });

  it('explains when a page has no rooms on it', () => {
    const blank: GrayImage = { width: 200, height: 100, data: new Uint8Array(20000).fill(255) };
    assert.throws(() => readFloorPlan(blank), FloorReadError);
  });
});

describe('rotateLabel', () => {
  it('follows the page when it is turned clockwise', () => {
    const l = { text: 'Kitchen', x: 0.2, y: 0.1 };
    assert.deepEqual(rotateLabel(l, 0), l);
    assert.deepEqual(rotateLabel(l, 90), { text: 'Kitchen', x: 0.9, y: 0.2 });
    assert.deepEqual(rotateLabel(l, 180), { text: 'Kitchen', x: 0.8, y: 0.9 });
    assert.deepEqual(rotateLabel(l, 270), { text: 'Kitchen', x: 0.1, y: 0.8 });
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

  it('maps labels onto the cropped page', () => {
    const crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
    const l = cropLabel({ text: 'Kitchen', x: 0.35, y: 0.45 }, crop)!;
    assert.ok(Math.abs(l.x - 0.5) < 1e-9 && Math.abs(l.y - 0.5) < 1e-9);
    assert.equal(cropLabel({ text: 'Title', x: 0.9, y: 0.9 }, crop), null);
  });
});
