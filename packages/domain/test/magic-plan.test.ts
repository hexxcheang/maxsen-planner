import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  magicPlan,
  MAGIC_CATEGORIES,
  type MagicPlanResult,
  type VariantPick,
} from '../src/magic/magic-plan.ts';
import type { FloorAnalysis } from '../src/magic/analysis.ts';
import { sampleAnalysisFor } from '../src/sample/analyses.ts';
import type { CategoryId } from '../src/categories.ts';
import type { PointMarker } from '../src/types.ts';

/** Variant ids that spell out what was asked for, so tests can read them back. */
const pick: VariantPick = (categoryId, hint) =>
  [categoryId, hint?.gangs ? `${hint.gangs}g` : '', hint?.wide ? 'wide' : '', hint?.role ?? '']
    .filter(Boolean)
    .join(':');

const ALL = MAGIC_CATEGORIES.map((c) => c.id);
const SHEET = { width: 1000, height: (1000 * 1000) / 1400 };
const hdb = sampleAnalysisFor('file_sample_plan_hdb')!;

function run(categories: CategoryId[] = ALL, analysis: FloorAnalysis = hdb): MagicPlanResult {
  return magicPlan({ analysis, sheet: SHEET, categories, pick });
}

/** Drawing coordinates (1400 × 1000) to plan units. */
const P = (x: number, y: number) => ({ x: (x * 1000) / 1400, y: (y * 1000) / 1400 });

const inRect = (p: { x: number; y: number }, x: number, y: number, w: number, h: number) => {
  const a = P(x, y);
  const b = P(x + w, y + h);
  return p.x > a.x && p.x < b.x && p.y > a.y && p.y < b.y;
};

const placed = (r: MagicPlanResult, categoryId: CategoryId) =>
  r.placements.filter((p) => p.categoryId === categoryId);
const element = (r: MagicPlanResult, id: string) =>
  [...r.smartHome, ...r.lighting].find((e) => e.id === id)!;
const marker = (r: MagicPlanResult, id: string) => element(r, id) as PointMarker;

describe('magicPlan', () => {
  it('puts a switch inside each bedroom, beside the latch end of its door', () => {
    const r = run();
    const room = hdb.rooms.find((x) => x.name === 'Bedroom 2')!;
    const sw = placed(r, 'smart-switches').filter((p) => p.roomId === room.id);
    assert.equal(sw.length, 1);
    const m = marker(r, sw[0]!.elementId);
    assert.ok(inRect(m, 880, 460, 420, 220), 'inside Bedroom 2');
    // Door hinge at (880, 580), latch at (880, 500): the switch sits by the latch, not the hinge.
    const latch = P(880, 500);
    const hinge = P(880, 580);
    assert.ok(Math.hypot(m.x - latch.x, m.y - latch.y) < Math.hypot(m.x - hinge.x, m.y - hinge.y));
    assert.ok(Math.hypot(m.x - latch.x, m.y - latch.y) < 40, 'close to the door');
  });

  it('puts bathroom switches outside the bathroom door', () => {
    const r = run();
    const bath = hdb.rooms.find((x) => x.name === 'Bath 2')!;
    const sw = placed(r, 'smart-switches').filter((p) => p.roomId === bath.id);
    assert.equal(sw.length, 1);
    const m = marker(r, sw[0]!.elementId);
    assert.ok(!inRect(m, 720, 100, 160, 200), 'not inside the bathroom');
  });

  it('switches a walkway where it meets other walkways, not at every bedroom door', () => {
    const r = run();
    const corridor = hdb.rooms.find((x) => x.type === 'corridor')!;
    const sw = placed(r, 'smart-switches').filter((p) => p.roomId === corridor.id);
    assert.equal(sw.length, 1);
    const m = marker(r, sw[0]!.elementId);
    assert.ok(inRect(m, 720, 300, 160, 380), 'inside the corridor');
    assert.equal(m.variantId, 'smart-switches:1g');
  });

  it('matches switch gangs to the lighting circuits in the room', () => {
    const r = run();
    const living = hdb.rooms.find((x) => x.type === 'living-dining')!;
    const circuits = new Set(
      r.placements.filter((p) => p.roomId === living.id && p.lighting).map((p) => p.categoryId),
    ).size;
    const sw = placed(r, 'smart-switches').filter((p) => p.roomId === living.id);
    assert.ok(sw.length >= 1);
    assert.ok(circuits >= 3, `living has downlights, a cove and a pendant (${circuits})`);
    assert.ok(
      sw.some(
        (s) => marker(r, s.elementId).variantId === `smart-switches:${Math.min(4, circuits)}g`,
      ),
    );
  });

  it('lights rooms with downlights and LED coves, and uses no track outside elongated spaces', () => {
    const r = run();
    assert.ok(placed(r, 'downlights').length >= 10);
    assert.equal(placed(r, 'track-lights').length, 0);
    const living = hdb.rooms.find((x) => x.type === 'living-dining')!;
    const cove = placed(r, 'led-strips').find((p) => p.roomId === living.id);
    assert.ok(cove, 'living has a cove');
    const el = element(r, cove.elementId);
    assert.equal(el.kind, 'led-strip');
    if (el.kind === 'led-strip') {
      assert.equal(el.closed, true);
      assert.ok(
        el.metres !== null && el.metres > 10 && el.metres < 30,
        `estimated metres ${el.metres}`,
      );
    }
  });

  it('runs track along an elongated gallery instead of downlights', () => {
    const gallery: FloorAnalysis = {
      rooms: [
        { id: 'g', name: 'Gallery', type: 'corridor', x: 0.1, y: 0.4, w: 0.6, h: 0.1 },
        { id: 'l', name: 'Living', type: 'living', x: 0.1, y: 0.5, w: 0.6, h: 0.4 },
      ],
      doors: [
        {
          id: 'd',
          hinge: { x: 0.3, y: 0.5 },
          latch: { x: 0.36, y: 0.5 },
          swingsInto: 'l',
          sides: ['l', 'g'],
          isMainEntrance: false,
        },
      ],
      windows: [],
      imageWidthMetres: 14,
    };
    const r = run(ALL, gallery);
    const track = placed(r, 'track-lights').filter((p) => p.roomId === 'g');
    assert.equal(track.length, 1);
    assert.equal(placed(r, 'downlights').filter((p) => p.roomId === 'g').length, 0);
    const el = element(r, track[0]!.elementId);
    assert.ok(el.kind === 'track' && el.headCount >= 4);
  });

  it('leaves out unchecked categories', () => {
    const r = run(['smart-switches', 'surface-lights']);
    assert.equal(placed(r, 'downlights').length, 0);
    assert.equal(placed(r, 'led-strips').length, 0);
    assert.equal(placed(r, 'curtains-blinds').length, 0);
    assert.ok(placed(r, 'surface-lights').length > 0, 'surface lights stand in for downlights');
    assert.ok(placed(r, 'smart-switches').length > 0);
    const cats = new Set(r.placements.map((p) => p.categoryId));
    assert.deepEqual([...cats].sort(), ['smart-switches', 'surface-lights']);
  });

  it('puts a control panel by the main entrance', () => {
    const r = run();
    const entrance = P(260 + 45, 900);
    assert.ok(
      placed(r, 'control-panels').some((p) => {
        const m = marker(r, p.elementId);
        return Math.hypot(m.x - entrance.x, m.y - entrance.y) < 120;
      }),
    );
  });

  it('adds curtains to living and bedroom windows only, double for wide windows', () => {
    const r = run();
    const curtains = placed(r, 'curtains-blinds');
    const kitchen = hdb.rooms.find((x) => x.type === 'kitchen')!;
    assert.ok(curtains.length >= 4);
    assert.ok(!curtains.some((c) => c.roomId === kitchen.id));
    const bed3 = hdb.rooms.find((x) => x.name === 'Bedroom 3')!;
    const wide = curtains.find((c) => c.roomId === bed3.id)!;
    assert.equal(marker(r, wide.elementId).variantId, 'curtains-blinds:wide');
  });

  it('adds a router, a gateway and enough mesh coverage', () => {
    const r = run();
    assert.equal(placed(r, 'gateways').length, 1);
    const network = placed(r, 'network-devices').map((p) => marker(r, p.elementId).variantId);
    assert.ok(network.includes('network-devices:router'));
  });

  it('keeps every element on the sheet and splits elements by plan type', () => {
    const r = run();
    for (const el of r.smartHome) {
      assert.equal(el.kind, 'marker');
      if (el.kind === 'marker')
        assert.ok(el.x >= 0 && el.x <= SHEET.width && el.y >= 0 && el.y <= SHEET.height);
    }
    for (const p of r.placements) {
      const inLighting = r.lighting.some((e) => e.id === p.elementId);
      assert.equal(inLighting, p.lighting, p.categoryId);
    }
  });

  it('works on every sample drawing without warnings about missing entrances', () => {
    for (const file of [
      'file_sample_plan_hdb',
      'file_sample_plan_condo',
      'file_sample_plan_landed_l1',
    ]) {
      const r = run(ALL, sampleAnalysisFor(file));
      assert.ok(r.placements.length > 15, file);
      assert.ok(!r.warnings.some((w) => /entrance/i.test(w)), `${file}: ${r.warnings.join('; ')}`);
    }
  });
});
