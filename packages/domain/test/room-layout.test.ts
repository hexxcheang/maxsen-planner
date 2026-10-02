import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisFromLayout,
  drawingWidthMetres,
  FLAT_PRESETS,
  layoutFromAnalysis,
  type RoomLayout,
} from '../src/magic/room-layout.ts';
import { floorAnalysisSchema } from '../src/magic/analysis.ts';
import { sampleAnalysisFor } from '../src/sample/analyses.ts';
import { magicPlan, MAGIC_CATEGORIES } from '../src/magic/magic-plan.ts';

describe('flat presets', () => {
  it('lists the rooms of a 5-room flat: 4 bedrooms, living, kitchen and 2 toilets', () => {
    const five = FLAT_PRESETS.find((p) => p.id === 'hdb-5')!;
    const count = (t: string) => five.rooms.filter((r) => r.type === t).length;
    assert.equal(count('master-bedroom') + count('bedroom'), 4);
    assert.equal(count('living-dining'), 1);
    assert.equal(count('kitchen'), 1);
    assert.equal(count('bathroom'), 2);
  });
});

describe('analysisFromLayout', () => {
  // A 10 m × 8 m flat drawn on a 1000 × 800 image (aspect 1.25), rooms in fractions.
  const layout: RoomLayout = {
    presetId: 'custom',
    floorAreaM2: 80 / 0.85,
    rooms: [
      {
        id: 'a',
        type: 'living-dining',
        name: 'Living',
        x: 0,
        y: 0,
        w: 0.6,
        h: 1,
        door: { x: 0.3, y: 0.99 },
      },
      {
        id: 'b',
        type: 'master-bedroom',
        name: 'Master',
        x: 0.6,
        y: 0,
        w: 0.4,
        h: 0.6,
        door: { x: 0.61, y: 0.3 },
      },
      { id: 'c', type: 'bathroom', name: 'Toilet', x: 0.6, y: 0.6, w: 0.4, h: 0.4, door: null },
    ],
  };
  const a = analysisFromLayout(layout, 1.25);

  it('works out the scale from the floor area', () => {
    assert.ok(Math.abs(drawingWidthMetres(layout, 1.25)! - 10) < 0.01);
    assert.equal(a.imageWidthMetres, 10);
    assert.doesNotThrow(() => floorAnalysisSchema.parse(a));
  });

  it('puts each door on the nearest wall and finds the room beyond it', () => {
    assert.equal(a.doors.length, 2);
    const living = a.doors[0]!;
    assert.deepEqual(living.sides, ['r1', null]);
    assert.equal(living.isMainEntrance, true);
    assert.ok(Math.abs(living.hinge.y - 1) < 1e-9 && Math.abs(living.latch.y - 1) < 1e-9);
    // 0.85 m wide on a 10 m wide drawing.
    assert.ok(Math.abs(living.latch.x - living.hinge.x - 0.085) < 1e-6);
    const master = a.doors[1]!;
    assert.deepEqual(master.sides, ['r2', 'r1']);
    assert.ok(Math.abs(master.hinge.x - 0.6) < 1e-9);
  });

  it('round-trips the sample analyses', () => {
    const hdb = sampleAnalysisFor('file_sample_plan_hdb')!;
    const layout = layoutFromAnalysis(hdb, 1.4);
    assert.equal(layout.rooms.length, hdb.rooms.length);
    const back = analysisFromLayout(layout, 1.4);
    assert.ok(Math.abs(back.imageWidthMetres! - 14) < 0.5, `${back.imageWidthMetres}`);
    assert.ok(back.doors.some((d) => d.isMainEntrance));
  });
});

describe('planning outlined rooms', () => {
  // The 4-room sample outlined as a user would: 7 rooms, corridor and service areas left out.
  const hdb = sampleAnalysisFor('file_sample_plan_hdb')!;
  const full = layoutFromAnalysis(hdb, 1.4);
  const keep = [
    'Master Bedroom',
    'Bedroom 2',
    'Bedroom 3',
    'Living / Dining',
    'Kitchen',
    'Bath 2',
    'M. Bath',
  ];
  const layout: RoomLayout = {
    presetId: 'hdb-4',
    floorAreaM2: 93,
    rooms: full.rooms.filter((r) => keep.includes(r.name)),
  };
  const analysis = analysisFromLayout(layout, 1.4);
  const result = magicPlan({
    analysis,
    sheet: { width: 1000, height: 1000 / 1.4 },
    categories: MAGIC_CATEGORIES.map((c) => c.id),
    pick: (c) => c,
  });
  const count = (name: string, cat: string) => {
    const id = analysis.rooms.find((r) => r.name === name)!.id;
    return result.placements.filter(
      (p) => p.categoryId === cat && (p.roomIds ?? [p.roomId]).includes(id),
    ).length;
  };

  it('gives every room one switch, toilets included', () => {
    for (const name of keep) assert.equal(count(name, 'smart-switches'), 1, name);
  });

  it('uses the agreed light counts', () => {
    const between = (n: number, lo: number, hi: number, what: string) =>
      assert.ok(n >= lo && n <= hi, `${what}: ${n}`);
    between(count('Living / Dining', 'downlights'), 8, 12, 'living downlights');
    between(count('Living / Dining', 'led-strips'), 3, 4, 'living strips');
    between(count('Master Bedroom', 'downlights'), 4, 6, 'master downlights');
    between(count('Master Bedroom', 'led-strips'), 0, 3, 'master strips');
    between(count('Bedroom 2', 'downlights'), 2, 4, 'bedroom downlights');
    between(count('Bedroom 2', 'led-strips'), 0, 2, 'bedroom strips');
    const total = (cat: string) => result.placements.filter((p) => p.categoryId === cat).length;
    assert.ok(total('downlights') > total('led-strips') * 2, 'more downlights than strips');
  });
});
