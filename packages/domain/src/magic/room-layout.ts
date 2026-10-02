/**
 * Rooms the user outlines on the drawing for Magic Plan: a rectangle per room and a tap where its
 * door is. Flat presets list the rooms a Singapore home of that size has, so nothing is guessed;
 * the drawing's scale comes from the home's floor area.
 */
import type { AnalysisDoor, FloorAnalysis, RoomType } from './analysis.ts';

export interface DrawnRoom {
  id: string;
  type: RoomType;
  name: string;
  /** Rectangle as fractions (0–1) of the drawing's width and height. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the room's door is, as fractions of the drawing; null until tapped. */
  door: { x: number; y: number } | null;
}

export interface DrawnWindow {
  id: string;
  /** Ends of the window along its wall, as fractions of the drawing. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RoomLayout {
  presetId: string;
  /** Approximate floor area of the home (or this level) in m², for the drawing's scale. */
  floorAreaM2: number;
  rooms: DrawnRoom[];
  /** Windows found on the drawing or marked by hand; absent until looked for. */
  windows?: DrawnWindow[];
}

export interface FlatPreset {
  id: string;
  name: string;
  floorAreaM2: number;
  rooms: { type: RoomType; name: string }[];
}

const bedrooms = (n: number) => [
  { type: 'master-bedroom' as const, name: 'Master Bedroom' },
  ...Array.from({ length: n - 1 }, (_, i) => ({
    type: 'bedroom' as const,
    name: `Bedroom ${i + 2}`,
  })),
];
const core = [
  { type: 'living-dining' as const, name: 'Living / Dining' },
  { type: 'kitchen' as const, name: 'Kitchen' },
];
const toilets = (n: number) =>
  n === 1
    ? [{ type: 'bathroom' as const, name: 'Toilet' }]
    : [
        { type: 'bathroom' as const, name: 'Master Toilet' },
        ...Array.from({ length: n - 1 }, (_, i) => ({
          type: 'bathroom' as const,
          name: n === 2 ? 'Common Toilet' : `Toilet ${i + 2}`,
        })),
      ];

/** Typical Singapore homes: an n-room flat has n − 1 bedrooms plus the living room. */
export const FLAT_PRESETS: readonly FlatPreset[] = [
  {
    id: 'hdb-2',
    name: '2-room flat',
    floorAreaM2: 45,
    rooms: [...bedrooms(1), ...core, ...toilets(1)],
  },
  {
    id: 'hdb-3',
    name: '3-room flat',
    floorAreaM2: 68,
    rooms: [...bedrooms(2), ...core, ...toilets(2)],
  },
  {
    id: 'hdb-4',
    name: '4-room flat',
    floorAreaM2: 93,
    rooms: [...bedrooms(3), ...core, ...toilets(2)],
  },
  {
    id: 'hdb-5',
    name: '5-room flat',
    floorAreaM2: 112,
    rooms: [...bedrooms(4), ...core, ...toilets(2)],
  },
  {
    id: 'executive',
    name: 'Executive flat / maisonette',
    floorAreaM2: 140,
    rooms: [...bedrooms(4), ...core, { type: 'study', name: 'Study' }, ...toilets(3)],
  },
  {
    id: 'condo-2',
    name: 'Condo, 2 bedrooms',
    floorAreaM2: 70,
    rooms: [...bedrooms(2), ...core, ...toilets(2)],
  },
  {
    id: 'condo-3',
    name: 'Condo, 3 bedrooms',
    floorAreaM2: 100,
    rooms: [...bedrooms(3), ...core, ...toilets(2)],
  },
  { id: 'custom', name: 'Other (add rooms yourself)', floorAreaM2: 90, rooms: [] },
];

/** Rooms that can be added to any layout. */
export const EXTRA_ROOMS: readonly { type: RoomType; name: string }[] = [
  { type: 'bedroom', name: 'Bedroom' },
  { type: 'bathroom', name: 'Toilet' },
  { type: 'living', name: 'Living Room' },
  { type: 'dining', name: 'Dining' },
  { type: 'family', name: 'Family Area' },
  { type: 'study', name: 'Study' },
  { type: 'kitchen', name: 'Kitchen' },
  { type: 'foyer', name: 'Foyer' },
  { type: 'corridor', name: 'Corridor' },
  { type: 'utility', name: 'Service Yard' },
  { type: 'store', name: 'Household Shelter' },
  { type: 'store', name: 'Store' },
  { type: 'balcony', name: 'Balcony' },
  { type: 'staircase', name: 'Stairs' },
];

/** Share of a home's floor area inside its rooms (the rest is walls, ledges and the like). */
const ROOMS_SHARE = 0.85;
const DOOR_M = 0.85;

/** Typical floor area (m²) of each kind of room, to share out the home's area among its rooms. */
const TYPICAL_M2: Partial<Record<RoomType, number>> = {
  living: 20,
  'living-dining': 28,
  family: 12,
  dining: 10,
  kitchen: 8,
  'master-bedroom': 14,
  bedroom: 10,
  study: 8,
  bathroom: 4,
  corridor: 5,
  foyer: 4,
  utility: 3,
  store: 2.5,
  balcony: 5,
  staircase: 5,
};
const typical = (t: RoomType) => TYPICAL_M2[t] ?? 6;

/**
 * The drawing's width in metres. The home's floor area is shared out among its listed rooms by
 * their typical sizes, so outlining only some rooms doesn't make them look bigger than they are.
 */
export function drawingWidthMetres(layout: RoomLayout, aspect: number): number | null {
  const outlined = layout.rooms.filter((r) => r.w > 0 && r.h > 0);
  const drawn = outlined.reduce((s, r) => s + r.w * r.h, 0);
  if (drawn <= 0 || layout.floorAreaM2 <= 0) return null;
  const share =
    outlined.reduce((s, r) => s + typical(r.type), 0) /
    layout.rooms.reduce((s, r) => s + typical(r.type), 0);
  return Math.sqrt((ROOMS_SHARE * layout.floorAreaM2 * share * aspect) / drawn);
}

/**
 * Turns drawn rooms into a floor analysis for Magic Plan. Each tapped door becomes an opening on
 * the nearest wall of its room, joining it to the drawn room beyond (or the outside). The living
 * room's (or foyer's) door to the outside is the main entrance. `aspect` is the drawing's
 * width / height.
 */
export function analysisFromLayout(all: RoomLayout, aspect: number): FloorAnalysis {
  // Rooms listed but not outlined yet are left out.
  const layout = { ...all, rooms: all.rooms.filter((r) => r.w > 0 && r.h > 0) };
  const widthM = drawingWidthMetres(all, aspect);
  const rooms = layout.rooms.map((r, i) => ({
    id: `r${i + 1}`,
    name: r.name,
    type: r.type,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  }));
  const idOf = new Map(layout.rooms.map((r, i) => [r.id, `r${i + 1}`]));
  /** The smallest drawn room containing a point, other than `except`. */
  const roomAt = (x: number, y: number, except: string) =>
    rooms
      .filter((r) => r.id !== except && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0]?.id ?? null;

  // Half a door and a step through it, as fractions along x and along y.
  const metres = widthM ?? 15;
  const fx = (m: number) => m / metres;
  const fy = (m: number) => (m * aspect) / metres;

  const doors: AnalysisDoor[] = [];
  for (const drawn of layout.rooms) {
    if (!drawn.door) continue;
    const id = idOf.get(drawn.id)!;
    const { x, y, w, h } = drawn;
    const p = drawn.door;
    // Snap the tap to the nearest wall of the room.
    const edges = [
      {
        d: Math.abs(p.y - y) / aspect,
        at: { x: clamp(p.x, x, x + w), y },
        horizontal: true,
        out: -1,
      },
      {
        d: Math.abs(p.y - (y + h)) / aspect,
        at: { x: clamp(p.x, x, x + w), y: y + h },
        horizontal: true,
        out: 1,
      },
      { d: Math.abs(p.x - x), at: { x, y: clamp(p.y, y, y + h) }, horizontal: false, out: -1 },
      {
        d: Math.abs(p.x - (x + w)),
        at: { x: x + w, y: clamp(p.y, y, y + h) },
        horizontal: false,
        out: 1,
      },
    ].sort((a, b) => a.d - b.d);
    const e = edges[0]!;
    const half = e.horizontal ? fx(DOOR_M / 2) : fy(DOOR_M / 2);
    const lo = e.horizontal
      ? clamp(e.at.x - half, x, x + w - 2 * half)
      : clamp(e.at.y - half, y, y + h - 2 * half);
    const hinge = e.horizontal ? { x: lo, y: e.at.y } : { x: e.at.x, y: lo };
    const latch = e.horizontal ? { x: lo + 2 * half, y: e.at.y } : { x: e.at.x, y: lo + 2 * half };
    const mid = { x: (hinge.x + latch.x) / 2, y: (hinge.y + latch.y) / 2 };
    const beyond = e.horizontal
      ? roomAt(mid.x, mid.y + e.out * fy(0.3), id)
      : roomAt(mid.x + e.out * fx(0.3), mid.y, id);
    doors.push({
      id: `d${doors.length + 1}`,
      hinge,
      latch,
      swingsInto: id,
      sides: [id, beyond],
      isMainEntrance: false,
    });
  }

  const typeOf = (id: string | null) => rooms.find((r) => r.id === id)?.type;
  const toOutside = doors.filter((d) => d.sides[1] === null);
  const entrance =
    toOutside.find((d) => typeOf(d.sides[0]) === 'foyer') ??
    toOutside.find((d) => /living|dining|family/.test(typeOf(d.sides[0]) ?? ''));
  if (entrance) entrance.isMainEntrance = true;

  return {
    rooms,
    doors,
    windows: windowsFor(all.windows ?? [], rooms, aspect, metres),
    imageWidthMetres: widthM ? Math.round(widthM * 10) / 10 : null,
  };
}

/**
 * Windows on the walls of the outlined rooms: each is given to the room with a parallel wall
 * running along it (within half a metre), preferring an indoor room over a balcony or outdoor area.
 * Windows only ever look outside, so one with another indoor room just beyond it is an inside wall
 * and is left out, as is one on no outlined room's wall.
 */
function windowsFor(
  windows: DrawnWindow[],
  rooms: { id: string; type: RoomType; x: number; y: number; w: number; h: number }[],
  aspect: number,
  metres: number,
): FloorAnalysis['windows'] {
  const near = 0.5 / metres; // half a metre, as a fraction of the drawing's width
  const beyond = 0.6 / metres;
  const outdoor = (r: { type: RoomType }) => ['outdoor', 'balcony'].includes(r.type);
  const out: FloorAnalysis['windows'] = [];
  windows.forEach((wd, i) => {
    const horizontal = Math.abs(wd.y2 - wd.y1) / aspect < Math.abs(wd.x2 - wd.x1);
    const mx = (wd.x1 + wd.x2) / 2;
    const my = (wd.y1 + wd.y2) / 2;
    // Distance (as a fraction of the width) from the window to the room's nearer parallel edge,
    // and which way is out of the room there.
    const edge = (r: (typeof rooms)[number]) => {
      if (horizontal) {
        if (mx < r.x || mx > r.x + r.w) return null;
        const top = Math.abs(my - r.y) / aspect;
        const bottom = Math.abs(my - (r.y + r.h)) / aspect;
        return top <= bottom ? { d: top, out: -1 } : { d: bottom, out: 1 };
      }
      if (my < r.y || my > r.y + r.h) return null;
      const left = Math.abs(mx - r.x);
      const right = Math.abs(mx - (r.x + r.w));
      return left <= right ? { d: left, out: -1 } : { d: right, out: 1 };
    };
    const candidates = rooms.filter((r) => {
      const e = edge(r);
      return e !== null && e.d <= near;
    });
    const room = candidates.find((r) => !outdoor(r)) ?? candidates[0];
    if (!room) return;
    const out1 = edge(room)!.out;
    const looksIntoRoom = [0.25, 0.5, 0.75].some((f) => {
      const px = horizontal
        ? wd.x1 + (wd.x2 - wd.x1) * f
        : (out1 < 0 ? room.x : room.x + room.w) + out1 * beyond;
      const py = horizontal
        ? (out1 < 0 ? room.y : room.y + room.h) + out1 * beyond * aspect
        : wd.y1 + (wd.y2 - wd.y1) * f;
      return rooms.some(
        (r) =>
          r !== room && !outdoor(r) && px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h,
      );
    });
    if (looksIntoRoom) return;
    out.push({
      id: `w${i + 1}`,
      start: { x: wd.x1, y: wd.y1 },
      end: { x: wd.x2, y: wd.y2 },
      roomId: room.id,
    });
  });
  return out;
}

/** A layout from an existing analysis (built-in samples, or rooms suggested by Claude). */
export function layoutFromAnalysis(a: FloorAnalysis, aspect: number): RoomLayout {
  const rooms: DrawnRoom[] = a.rooms.map((r) => {
    const door =
      a.doors.find((d) => d.swingsInto === r.id) ?? a.doors.find((d) => d.sides.includes(r.id));
    return {
      id: r.id,
      type: r.type,
      name: r.name,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      door: door
        ? { x: (door.hinge.x + door.latch.x) / 2, y: (door.hinge.y + door.latch.y) / 2 }
        : null,
    };
  });
  const drawn = rooms.reduce((s, r) => s + r.w * r.h, 0);
  const widthM = a.imageWidthMetres;
  const floorAreaM2 = widthM ? Math.round((drawn * widthM * widthM) / aspect / ROOMS_SHARE) : 90;
  const windows = a.windows.map((w) => ({
    id: w.id,
    x1: w.start.x,
    y1: w.start.y,
    x2: w.end.x,
    y2: w.end.y,
  }));
  return { presetId: 'custom', floorAreaM2, rooms, windows };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
