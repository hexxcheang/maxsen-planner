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
  it('puts a switch inside each bedroom, beside its door at the end with more wall', () => {
    const r = run();
    const room = hdb.rooms.find((x) => x.name === 'Bedroom 2')!;
    const sw = placed(r, 'smart-switches').filter((p) => p.roomId === room.id);
    assert.equal(sw.length, 1);
    const m = marker(r, sw[0]!.elementId);
    assert.ok(inRect(m, 880, 460, 420, 220), 'inside Bedroom 2');
    // Opening from (880, 500) to (880, 580) in a room spanning y 460–680: 1 m of wall below the
    // opening, 0.4 m above, so the switch goes below. Which way the door swings doesn't matter.
    const latch = P(880, 580);
    const hinge = P(880, 500);
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

  it('lights rooms with downlights and LED strips, and uses no track outside elongated spaces', () => {
    const r = run();
    assert.ok(placed(r, 'downlights').length >= 10);
    assert.equal(placed(r, 'track-lights').length, 0);
    const living = hdb.rooms.find((x) => x.type === 'living-dining')!;
    const strips = placed(r, 'led-strips').filter((p) => p.roomId === living.id);
    assert.ok(
      strips.length >= 3 && strips.length <= 4,
      `${strips.length} strips in the living room`,
    );
    for (const s of strips) {
      const el = element(r, s.elementId);
      assert.equal(el.kind, 'led-strip');
      if (el.kind === 'led-strip') {
        assert.equal(el.closed, false);
        assert.ok(el.metres !== null && el.metres > 1 && el.metres < 10, `metres ${el.metres}`);
      }
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

  it('merges switches that would share a spot into one plate with more gangs', () => {
    const l2 = sampleAnalysisFor('file_sample_plan_landed_l2')!;
    const r = run(ALL, l2);
    const sw = placed(r, 'smart-switches').map((p) => marker(r, p.elementId));
    for (const [i, a] of sw.entries()) {
      for (const b of sw.slice(i + 1))
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 15, 'no stacked switches');
    }
    const master = l2.rooms.find((x) => x.type === 'master-bedroom')!;
    const balcony = l2.rooms.find((x) => x.type === 'balcony')!;
    const shared = placed(r, 'smart-switches').find((p) => p.roomId === master.id)!;
    // Master (downlights, strips, fan) plus the balcony light share one plate.
    assert.match(marker(r, shared.elementId).variantId, /smart-switches:[34]g/);
    assert.equal(
      placed(r, 'smart-switches').some((p) => p.roomId === balcony.id),
      false,
    );
  });

  it('switches an open-plan living room where you walk in, not from a bedroom door', () => {
    const condo = sampleAnalysisFor('file_sample_plan_condo')!;
    const r = run(ALL, condo);
    const living = condo.rooms.find((x) => x.type === 'living-dining')!;
    const sw = placed(r, 'smart-switches')
      .filter((p) => p.roomId === living.id)
      .map((p) => marker(r, p.elementId));
    assert.equal(sw.length, 1);
    // Living spans 100–800 × 220–660; the foyer opening is along its bottom edge near x 500–800.
    assert.ok(inRect(sw[0]!, 500, 560, 300, 100), `near the foyer (${sw[0]!.x}, ${sw[0]!.y})`);
  });

  it('switches a balcony without a door from the room next to it', () => {
    const condo = sampleAnalysisFor('file_sample_plan_condo')!;
    const r = run(ALL, condo);
    const balcony = condo.rooms.find((x) => x.type === 'balcony')!;
    const sw = placed(r, 'smart-switches').filter(
      (p) => p.roomId === balcony.id || p.roomIds?.includes(balcony.id),
    );
    assert.equal(sw.length, 1);
    assert.ok(!inRect(marker(r, sw[0]!.elementId), 100, 100, 700, 120), 'not out on the balcony');
  });

  it('still plans switches when no lighting categories are ticked', () => {
    const r = run(['smart-switches']);
    assert.ok(placed(r, 'smart-switches').length >= 8);
    assert.equal(r.lighting.length, 0);
  });

  it('never puts Wi-Fi nodes on balconies or outdoors', () => {
    for (const file of [
      'file_sample_plan_hdb',
      'file_sample_plan_condo',
      'file_sample_plan_landed_l1',
      'file_sample_plan_landed_l2',
    ]) {
      const a = sampleAnalysisFor(file)!;
      const r = run(ALL, a);
      for (const p of placed(r, 'network-devices')) {
        const type = a.rooms.find((x) => x.id === p.roomId)?.type;
        assert.ok(
          !['balcony', 'outdoor', 'garage', 'bathroom'].includes(type ?? ''),
          `${file}: ${type}`,
        );
      }
    }
  });
});

describe('Singapore lighting conventions', () => {
  const r = run();
  const lightsIn = (name: string, categoryId: CategoryId = 'downlights') => {
    const room = hdb.rooms.find((x) => x.name === name)!;
    return placed(r, categoryId)
      .filter((p) => p.roomId === room.id)
      .map((p) => marker(r, p.elementId));
  };

  it('gives the household shelter exactly one surface light and switches it from outside', () => {
    assert.equal(lightsIn('Shelter', 'surface-lights').length, 1);
    assert.equal(lightsIn('Shelter').length, 0);
    const shelter = hdb.rooms.find((x) => x.name === 'Shelter')!;
    const sw = placed(r, 'smart-switches').filter((p) =>
      (p.roomIds ?? [p.roomId]).includes(shelter.id),
    );
    assert.equal(sw.length, 1);
    assert.ok(!inRect(marker(r, sw[0]!.elementId), 560, 100, 160, 260), 'switch outside');
  });

  it('keeps downlights at least 0.5 m off the walls in living spaces and bedrooms', () => {
    const margin = (0.5 * 1000) / 14 - 0.5; // 0.5 m in plan units
    for (const name of ['Living / Dining', 'Bedroom 2', 'Bedroom 3']) {
      const room = hdb.rooms.find((x) => x.name === name)!;
      for (const p of lightsIn(name)) {
        const x0 = room.x * 1000;
        const y0 = room.y * (1000 / 1.4);
        const x1 = x0 + room.w * 1000;
        const y1 = y0 + room.h * (1000 / 1.4);
        const gap = Math.min(p.x - x0, x1 - p.x, p.y - y0, y1 - p.y);
        assert.ok(gap >= margin || gap >= Math.min(x1 - x0, y1 - y0) / 2 - 1, `${name}: ${gap}`);
      }
    }
  });

  it('does not over-light: about one downlight per 1.5 m² at most', () => {
    const total = placed(r, 'downlights').length;
    // The 4-room sample is about 95 m² indoors; research puts it at 18–24 fittings.
    assert.ok(total >= 12 && total <= 40, `${total} downlights`);
  });

  it('puts one switch by the door of each room', () => {
    for (const room of hdb.rooms.filter((x) => x.type !== 'bathroom' && x.type !== 'store')) {
      const plates = placed(r, 'smart-switches').filter((p) =>
        (p.roomIds ?? [p.roomId]).includes(room.id),
      );
      assert.equal(plates.length, 1, `${room.name}: ${plates.length} switches`);
    }
  });

  it('uses the agreed numbers of downlights and LED strips per room', () => {
    const count = (name: string, categoryId: CategoryId) => lightsIn(name, categoryId).length;
    const between = (n: number, lo: number, hi: number, what: string) =>
      assert.ok(n >= lo && n <= hi, `${what}: ${n}`);
    between(count('Living / Dining', 'downlights'), 8, 12, 'living downlights');
    between(count('Living / Dining', 'led-strips'), 3, 4, 'living strips');
    between(count('Master Bedroom', 'downlights'), 4, 6, 'master downlights');
    between(count('Master Bedroom', 'led-strips'), 0, 3, 'master strips');
    for (const b of ['Bedroom 2', 'Bedroom 3']) {
      between(count(b, 'downlights'), 2, 4, `${b} downlights`);
      between(count(b, 'led-strips'), 0, 2, `${b} strips`);
    }
  });

  it('lights a corridor with a single centre row', () => {
    const pts = lightsIn('Corridor');
    assert.ok(pts.length >= 2);
    assert.ok(
      pts.every((p) => Math.abs(p.x - pts[0]!.x) < 1),
      'one straight row',
    );
  });

  it('runs kitchen downlights in a row along the cabinet wall', () => {
    const pts = lightsIn('Kitchen');
    assert.ok(pts.length >= 2);
    const ys = new Set(pts.map((p) => Math.round(p.y)));
    const xs = new Set(pts.map((p) => Math.round(p.x)));
    assert.ok(ys.size <= 2 || xs.size <= 2, 'rows, not a scattered grid');
  });
});

describe('ceiling fans', () => {
  const r = run();
  const fanIn = (name: string) => {
    const room = hdb.rooms.find((x) => x.name === name)!;
    return placed(r, 'ceiling-fans')
      .filter((p) => p.roomId === room.id)
      .map((p) => marker(r, p.elementId));
  };

  it('hangs a fan in the living area and bedrooms, sized for the room', () => {
    assert.equal(fanIn('Living / Dining').length, 1);
    assert.equal(fanIn('Bedroom 3').length, 1);
    assert.equal(fanIn('Bath 2').length, 0);
    assert.equal(fanIn('Kitchen').length, 0);
    assert.equal(fanIn('Bedroom 3')[0]!.variantId, 'ceiling-fans');
  });

  it('keeps downlights clear of the blades', () => {
    for (const name of ['Living / Dining', 'Bedroom 2', 'Bedroom 3']) {
      const room = hdb.rooms.find((x) => x.name === name)!;
      const fan = fanIn(name)[0];
      if (!fan) continue; // a room too tight for a fan and its lights keeps the lights
      const lights = placed(r, 'downlights')
        .filter((p) => p.roomId === room.id)
        .map((p) => marker(r, p.elementId));
      // 46" fan: 0.58 m blade tip + 0.3 m, in plan units at 14 m per 1000.
      for (const l of lights) assert.ok(Math.hypot(l.x - fan.x, l.y - fan.y) > (0.88 * 1000) / 14);
    }
  });

  it('picks the fan size from the catalogue', async () => {
    const { createVariantPicker } = await import('../src/magic/variant-picker.ts');
    const { SAMPLE_PRODUCTS, SAMPLE_VARIANTS } = await import('../src/sample/catalogue.ts');
    const pickFan = createVariantPicker({
      products: SAMPLE_PRODUCTS,
      variants: SAMPLE_VARIANTS,
      favouriteVariantIds: [],
    });
    assert.equal(pickFan('ceiling-fans', { fanInches: 46 }), 'var_breeze_fan_46');
    assert.equal(pickFan('ceiling-fans', { fanInches: 52 }), 'var_breeze_fan_52');
  });
});
