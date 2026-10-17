/**
 * Ready-made Magic Plan analyses of the sample drawings, derived from the geometry they are drawn
 * from. Lets the sample projects (and tests) run Magic Plan without calling the vision model.
 */
import type { FloorAnalysis, RoomType } from '../magic/analysis.ts';
import { SAMPLE_DRAWINGS, type Drawing } from './drawings.ts';
import { roomTypeFromName } from '../magic/room-types.ts';

const W = 1400;
const H = 1000;

function roomType(label: string): RoomType {
  if (label.trim() === '') return 'corridor';
  return roomTypeFromName(label) ?? 'other';
}

/** The exact analysis of a sample drawing, from the geometry it is drawn with. */
export function analyseSampleDrawing(d: Drawing): FloorAnalysis {
  const rooms = d.rooms.map((r, i) => ({
    id: `r${i + 1}`,
    name: r.label.trim() === '' ? 'Corridor' : r.label,
    type: roomType(r.label),
    x: r.x / W,
    y: r.y / H,
    w: r.w / W,
    h: r.h / H,
  }));
  // The smallest room containing a point owns it (a bath drawn inside a bedroom's outline wins).
  const owner = (x: number, y: number) => {
    let best: (typeof rooms)[number] | null = null;
    for (const [i, r] of d.rooms.entries()) {
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      const room = rooms[i]!;
      if (!best || r.w * r.h < best.w * W * best.h * H) best = room;
    }
    return best;
  };
  const outdoor = (id: string | null) =>
    id === null || rooms.find((r) => r.id === id)?.type === 'outdoor';

  const doors = d.doors.map((door, i) => {
    const mx = door.x + (door.ax * door.size) / 2;
    const my = door.y + (door.ay * door.size) / 2;
    const into = owner(mx + door.px * 15, my + door.py * 15)?.id ?? null;
    const away = owner(mx - door.px * 15, my - door.py * 15)?.id ?? null;
    return {
      id: `d${i + 1}`,
      hinge: { x: door.x / W, y: door.y / H },
      latch: { x: (door.x + door.ax * door.size) / W, y: (door.y + door.ay * door.size) / H },
      swingsInto: into,
      sides: [into, away] as [string | null, string | null],
      isMainEntrance: false,
    };
  });

  // Main entrance: a door from outside (or an outdoor area) into the foyer, else into a living space.
  const typeOf = (id: string | null) => rooms.find((r) => r.id === id)?.type;
  const entrance =
    doors.find((x) => x.sides.some(outdoor) && x.sides.some((s) => typeOf(s) === 'foyer')) ??
    doors.find((x) => x.sides.some(outdoor) && x.sides.some((s) => /living/.test(typeOf(s) ?? '')));
  if (entrance) entrance.isMainEntrance = true;

  const windows = d.windows.map((w, i) => {
    const mx = (w.x1 + w.x2) / 2;
    const my = (w.y1 + w.y2) / 2;
    const horizontal = w.y1 === w.y2;
    const candidates = [
      owner(mx + (horizontal ? 0 : 15), my + (horizontal ? 15 : 0)),
      owner(mx - (horizontal ? 0 : 15), my - (horizontal ? 15 : 0)),
    ];
    const room =
      candidates.find((r) => r && r.type !== 'outdoor') ?? candidates.find(Boolean) ?? null;
    return {
      id: `w${i + 1}`,
      start: { x: w.x1 / W, y: w.y1 / H },
      end: { x: w.x2 / W, y: w.y2 / H },
      roomId: room?.id ?? null,
    };
  });

  // Sample drawings are drawn at roughly 1 cm per unit.
  return { rooms, doors, windows, imageWidthMetres: 14 };
}

const FILE_IDS: Record<string, string> = {
  'floorplan-hdb-4room.svg': 'file_sample_plan_hdb',
  'floorplan-condo-2bed.svg': 'file_sample_plan_condo',
  'floorplan-landed-l1.svg': 'file_sample_plan_landed_l1',
  'floorplan-landed-l2.svg': 'file_sample_plan_landed_l2',
  'floorplan-landed-attic.svg': 'file_sample_plan_landed_attic',
};

const BY_FILE = new Map(
  SAMPLE_DRAWINGS.map((d) => [FILE_IDS[d.file] ?? d.file, analyseSampleDrawing(d)]),
);

/** The built-in analysis of a sample background drawing, if it is one. */
export function sampleAnalysisFor(fileId: string): FloorAnalysis | undefined {
  return BY_FILE.get(fileId);
}
