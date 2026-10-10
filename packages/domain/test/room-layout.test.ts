import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisFromLayout,
  drawingWidthMetres,
  FLAT_PRESETS,
  layoutFromAnalysis,
  partBoxes,
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

describe('light counts follow the size of the box drawn', () => {
  // A 10 m wide drawing (aspect 1.25): fractions × 10 m wide, × 8 m tall.
  const plan = (w: number, h: number, type: 'family' | 'living-dining' | 'bedroom') => {
    const layout: RoomLayout = {
      presetId: 'custom',
      floorAreaM2: 80 / 0.85,
      rooms: [
        { id: 'a', type, name: 'Room', x: 0.1, y: 0.1, w, h, door: null },
        // Filler so the drawn area (and so the scale) stays 80 m².
        { id: 'b', type: 'store', name: 'Rest', x: 0, y: 0, w: 1, h: 1 - (w * h) / 1, door: null },
      ],
    };
    const analysis = analysisFromLayout({ ...layout, rooms: layout.rooms.slice(0, 1) }, 1.25);
    // Fix the scale: 10 m across.
    analysis.imageWidthMetres = 10;
    const r = magicPlan({
      analysis,
      sheet: { width: 1000, height: 800 },
      categories: MAGIC_CATEGORIES.map((c) => c.id),
      pick: (c) => c,
    });
    return r.placements.filter((p) => p.categoryId === 'downlights').length;
  };

  it('gives a small family area a few downlights, not 8', () => {
    // 2.5 m × 2.4 m ≈ 6 m².
    const n = plan(0.25, 0.3, 'family');
    assert.ok(n >= 2 && n <= 3, `${n}`);
  });

  it('gives a big living room up to 12', () => {
    // 6 m × 5.6 m ≈ 34 m².
    const n = plan(0.6, 0.7, 'living-dining');
    assert.ok(n >= 10 && n <= 12, `${n}`);
  });

  it('scales bedrooms between 2 and 4', () => {
    assert.ok(plan(0.28, 0.35, 'bedroom') <= 3); // ≈ 7.8 m²
    assert.equal(plan(0.4, 0.5, 'bedroom'), 4); // 16 m²
  });
});

describe('scale with only some rooms outlined', () => {
  it('does not blow up the size of the rooms that are outlined', () => {
    const rooms = FLAT_PRESETS.find((p) => p.id === 'hdb-4')!.rooms.map((r, i) => ({
      id: `x${i}`,
      ...r,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      door: null,
    }));
    // Only the living room outlined: half the drawing's width, a third of its height.
    rooms[3] = { ...rooms[3]!, x: 0, y: 0, w: 0.5, h: 1 / 3 };
    const width = drawingWidthMetres({ presetId: 'hdb-4', floorAreaM2: 93, rooms }, 1.4)!;
    const livingM2 = 0.5 * width * ((1 / 3) * (width / 1.4));
    // About the typical share of a 93 m² flat for its living room, not the whole flat.
    assert.ok(livingM2 > 15 && livingM2 < 35, `${livingM2.toFixed(1)} m²`);
  });
});

describe('windows on outlined rooms', () => {
  const hdb = sampleAnalysisFor('file_sample_plan_hdb')!;
  const layout = layoutFromAnalysis(hdb, 1.4);
  const analysis = analysisFromLayout(layout, 1.4);
  const r = magicPlan({
    analysis,
    sheet: { width: 1000, height: 1000 / 1.4 },
    categories: MAGIC_CATEGORIES.map((c) => c.id),
    pick: (c) => c,
  });
  const el = (id: string) => [...r.smartHome, ...r.lighting].find((e) => e.id === id)!;

  it('gives each window to the room whose wall it is on', () => {
    const living = analysis.rooms.find((x) => x.name === 'Living / Dining')!;
    const bed3 = analysis.rooms.find((x) => x.name === 'Bedroom 3')!;
    // Living's west wall window, and Bedroom 3's south wall window.
    assert.ok(analysis.windows.some((w) => w.roomId === living.id && w.start.x < 0.08));
    assert.ok(analysis.windows.some((w) => w.roomId === bed3.id && w.start.y > 0.88));
  });

  it('runs a curtain cove strip along each living room and bedroom window, near the wall', () => {
    for (const name of ['Living / Dining', 'Bedroom 3', 'Master Bedroom']) {
      const room = analysis.rooms.find((x) => x.name === name)!;
      const win = analysis.windows.find((w) => w.roomId === room.id)!;
      const vertical = Math.abs(win.start.x - win.end.x) < 1e-6;
      const wallAt = vertical ? win.start.x * 1000 : (win.start.y * 1000) / 1.4;
      const strips = r.placements
        .filter((p) => p.categoryId === 'led-strips' && p.roomId === room.id)
        .map((p) => el(p.elementId))
        .filter((e) => e.kind === 'led-strip');
      const cove = strips.find((e) =>
        e.points.every((p) => Math.abs((vertical ? p.x : p.y) - wallAt) < 0.5 * (1000 / 14)),
      );
      assert.ok(cove, `${name} has a strip within 0.5 m of its window wall`);
      const curtains = r.placements.filter(
        (p) => p.categoryId === 'curtains-blinds' && p.roomId === room.id,
      );
      assert.ok(curtains.length >= 1, `${name} has a curtain`);
    }
  });
});

describe('windows only on the outside', () => {
  // Square drawing: a living room on the left, a bedroom top right, a dining area bottom right.
  const layout: RoomLayout = {
    presetId: 'custom',
    floorAreaM2: 60,
    rooms: [
      { id: 'a', type: 'living', name: 'Living', x: 0.1, y: 0.1, w: 0.4, h: 0.8, door: null },
      { id: 'b', type: 'bedroom', name: 'Bedroom', x: 0.5, y: 0.1, w: 0.4, h: 0.4, door: null },
      { id: 'c', type: 'dining', name: 'Dining', x: 0.5, y: 0.5, w: 0.4, h: 0.4, door: null },
    ],
    windows: [
      // On the living room's outer (left) wall.
      { id: 'w1', x1: 0.1, y1: 0.3, x2: 0.1, y2: 0.6 },
      // On the wall between the living room and the bedroom: inside the home.
      { id: 'w2', x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.4 },
      // On the bedroom's outer (top) wall.
      { id: 'w3', x1: 0.6, y1: 0.1, x2: 0.8, y2: 0.1 },
      // Nowhere near an outlined room.
      { id: 'w4', x1: 0.95, y1: 0.95, x2: 0.99, y2: 0.95 },
      // On the dining area's outer (right) wall.
      { id: 'w5', x1: 0.9, y1: 0.6, x2: 0.9, y2: 0.8 },
    ],
  };
  const analysis = analysisFromLayout(layout, 1);
  const rooms = Object.fromEntries(analysis.rooms.map((r) => [r.name, r.id]));

  it('keeps windows on outside walls and drops ones between rooms or on no room', () => {
    assert.deepEqual(
      analysis.windows.map((w) => [w.id, w.roomId]),
      [
        ['w1', rooms.Living],
        ['w3', rooms.Bedroom],
        ['w5', rooms.Dining],
      ],
    );
  });

  it('puts curtains only in living rooms, bedrooms and studies', () => {
    const r = magicPlan({
      analysis,
      sheet: { width: 1000, height: 1000 },
      categories: ['curtains-blinds'],
      pick: (c) => c,
    });
    const curtains = r.placements.filter((p) => p.categoryId === 'curtains-blinds');
    assert.deepEqual(curtains.map((c) => c.roomId).sort(), [rooms.Bedroom, rooms.Living].sort());
  });

  it('plans no curtains when there are no windows', () => {
    const r = magicPlan({
      analysis: analysisFromLayout({ ...layout, windows: [] }, 1),
      sheet: { width: 1000, height: 1000 },
      categories: ['curtains-blinds'],
      pick: (c) => c,
    });
    assert.equal(r.placements.filter((p) => p.categoryId === 'curtains-blinds').length, 0);
  });
});

describe('rooms of more than one rectangle', () => {
  // An L-shaped living room: a box across the top and a part down the left, drawn overlapping it.
  const living = {
    id: 'a',
    type: 'living' as const,
    name: 'Living',
    x: 0.1,
    y: 0.1,
    w: 0.4,
    h: 0.3,
    door: { x: 0.2, y: 0.8 },
    parts: [{ x: 0.1, y: 0.35, w: 0.2, h: 0.45 }],
  };
  const layout: RoomLayout = {
    presetId: 'custom',
    floorAreaM2: 90,
    rooms: [
      living,
      {
        id: 'b',
        type: 'bedroom',
        name: 'Bedroom',
        x: 0.5,
        y: 0.1,
        w: 0.4,
        h: 0.4,
        door: { x: 0.5, y: 0.3 },
      },
    ],
  };
  const analysis = analysisFromLayout(layout, 1);
  const main = analysis.rooms.find((r) => r.name === 'Living' && !r.partOf)!;
  const part = analysis.rooms.find((r) => r.partOf === main.id)!;
  const r = magicPlan({
    analysis,
    sheet: { width: 1000, height: 1000 },
    categories: MAGIC_CATEGORIES.map((c) => c.id),
    pick: (c) => c,
  });
  const el = (id: string) => [...r.smartHome, ...r.lighting].find((e) => e.id === id)!;
  const of = (cat: string) =>
    r.placements.filter((p) => p.categoryId === cat && p.roomId === main.id);

  it('trims a part to what it adds to the room', () => {
    const [box, ...rest] = partBoxes(living);
    assert.equal(rest.length, 0);
    assert.ok(Math.abs(box!.y - 0.4) < 1e-9 && Math.abs(box!.h - 0.4) < 1e-9);
    assert.ok(part && Math.abs(part.y - 0.4) < 1e-9);
  });

  it('snaps the door to the part it was tapped on, as the main entrance', () => {
    const door = analysis.doors.find((d) => d.sides[0] === part.id)!;
    assert.ok(door.isMainEntrance);
    assert.ok(Math.abs(door.hinge.y - 0.8) < 1e-9);
  });

  it('plans the parts as one room: lights in each, one switch and one fan', () => {
    assert.ok(!r.placements.some((p) => p.roomId === part.id), 'all credited to the room');
    const lights = of('downlights').map((p) => el(p.elementId) as { x: number; y: number });
    const inPart = lights.filter((p) => p.y > 400);
    assert.ok(inPart.length >= 1 && lights.length - inPart.length >= 1, 'lights in both');
    assert.ok(lights.length >= 4 && lights.length <= 12, `${lights.length} lights`);
    assert.equal(of('smart-switches').length, 1);
    assert.ok(of('ceiling-fans').length <= 1);
  });

  it('keeps LED strips off the seam between the parts', () => {
    for (const p of of('led-strips')) {
      const strip = el(p.elementId) as { points: { x: number; y: number }[] };
      // A run along the seam would lie across it, near y = 400, over the part (x < 300).
      const [a, b] = strip.points as [{ x: number; y: number }, { x: number; y: number }];
      const alongSeam = Math.abs(a.y - 400) < 40 && Math.abs(b.y - 400) < 40;
      assert.ok(!(alongSeam && Math.min(a.x, b.x) < 290), `strip on the seam: ${a.x}–${b.x}`);
    }
  });
});
