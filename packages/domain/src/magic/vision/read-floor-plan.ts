/**
 * Reads a floor-plan image on this computer, without a vision model: finds the walls, closes the
 * door and window gaps to get the rooms, tells doors from windows by the swing arc or glazing drawn
 * in each gap, and names rooms from the drawing's text labels. Anything it isn't sure of is listed
 * in `issues` so the app can ask the user to check before planning.
 */
import type {
  AnalysisDoor,
  AnalysisRoom,
  AnalysisWindow,
  FloorAnalysis,
  RoomType,
} from '../analysis.ts';
import { cleanLabel, roomTypeFromName } from '../room-types.ts';
import { components, type Component, type GrayImage } from './image.ts';
import { closeGaps, findGaps, findWalls, MAX_OPEN_GAP, type Gap, type Walls } from './walls.ts';

/** A piece of text on the drawing, positioned by its centre as fractions of the image size. */
export interface DrawingLabel {
  text: string;
  x: number;
  y: number;
  /** OCR confidence 0–100; absent for text taken from the file itself. */
  confidence?: number;
}

export interface FloorReading {
  analysis: FloorAnalysis;
  /** Things worth a look before planning; empty when the reading looks complete. */
  issues: string[];
}

export class FloorReadError extends Error {}

/** A typical door leaf, used to work out the drawing's scale from the door openings found. */
const DOOR_METRES = 0.85;

interface Swing {
  /** End of the gap the door is hinged at. */
  hinge: 'lo' | 'hi';
  /** Side of the wall the leaf swings to: −1 above/left, +1 below/right. */
  side: -1 | 1;
}

export function readFloorPlan(
  img: GrayImage,
  opts: { labels?: DrawingLabel[] } = {},
): FloorReading {
  const walls = findWalls(img);
  const { width: w, height: h, thickness: t } = walls;

  // Close the doors and windows first, then look again: a door opening can cut off the end of the
  // wall beside it, and that wall should meet the closed door rather than run on across a room.
  const classified: Classified[] = [];
  let closed = walls.wall;
  let found = walls.gaps;
  for (let pass = 0; pass < 4 && found.length > 0; pass++) {
    const next = found
      .map((g) => classify(walls, g))
      .filter((c) => (c.kind === 'opening' ? pass > 0 && length(c.gap) <= MAX_OPEN_GAP * t : true));
    classified.push(...next);
    closed = closeGaps(
      closed,
      w,
      next.map((c) => c.gap),
    );
    found = findGaps(closed, walls.ink, w, h, t);
  }
  const bridged = classified;

  // Rooms: enclosed free space. Space reaching the image edge (or a sheet frame) is outside.
  const { labels: regionOf, stats } = components(closed, w, h, 0);
  const minArea = 0.002 * w * h;
  const kept = stats.filter((c) => {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    const frame = bw > 0.9 * w && bh > 0.9 * h;
    return !c.touchesBorder && !frame && c.area >= minArea && Math.min(bw, bh) >= 3 * t;
  });
  if (kept.length === 0) {
    throw new FloorReadError(
      'Couldn’t find any rooms on this drawing. Magic Plan reads clear plans with solid walls best — try a cleaner page or one floor per page.',
    );
  }
  kept.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const roomIdOf = new Map<number, string>(kept.map((c, i) => [c.label, `r${i + 1}`]));
  const roomAt = (x: number, y: number): string | null => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return null;
    return roomIdOf.get(regionOf[yi * w + xi]!) ?? null;
  };
  /** The room (or null for outside) found walking away from a gap's centre on one side. */
  const sideRoom = (g: Gap, side: -1 | 1): string | null => {
    const mid = (g.lo + g.hi) / 2;
    const edge = side === 1 ? g.b1 : g.b0;
    for (let d = 1; d <= 3 * t; d++) {
      const c = edge + side * d;
      const [x, y] = g.axis === 'h' ? [mid, c] : [c, mid];
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const region = regionOf[Math.round(y) * w + Math.round(x)]!;
      if (region) return roomIdOf.get(region) ?? null;
    }
    return null;
  };

  const rooms: AnalysisRoom[] = kept.map((c, i) => ({
    id: `r${i + 1}`,
    name: '',
    type: 'other',
    x: c.x0 / w,
    y: c.y0 / h,
    w: (c.x1 - c.x0 + 1) / w,
    h: (c.y1 - c.y0 + 1) / h,
  }));

  // Scale from the door openings: the typical one is a standard door leaf. Gaps with a swing drawn
  // in them are surely doors; fall back to every opening when too few have one.
  const swung = bridged.filter((c) => c.kind === 'door');
  const doorSizes = (swung.length >= 2 ? swung : bridged.filter((c) => c.kind !== 'window'))
    .map((c) => length(c.gap))
    .filter((n) => n >= 2 * t)
    .sort((p, q) => p - q);
  const median = doorSizes.length ? doorSizes[Math.floor(doorSizes.length / 2)]! : null;
  const imageWidthMetres = median ? Math.round((w / (median / DOOR_METRES)) * 10) / 10 : null;
  const pxPerMetre = median ? median / DOOR_METRES : null;

  const { unnamed, unsure } = nameRooms(rooms, opts.labels ?? [], (fx, fy) => {
    // A label sitting on a wall or fitting belongs to the nearest room around it.
    for (let r = 0; r <= 3 * t; r += Math.max(1, Math.floor(t / 2))) {
      for (const [dx, dy] of [
        [0, 0],
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ] as const) {
        const id = roomAt(fx * w + dx, fy * h + dy);
        if (id) return id;
      }
    }
    return null;
  });
  guessTypes(rooms, unnamed, kept, pxPerMetre);

  const pt = (g: Gap, along: number) =>
    g.axis === 'h'
      ? { x: along / w, y: (g.b0 + g.b1 + 1) / 2 / h }
      : { x: (g.b0 + g.b1 + 1) / 2 / w, y: along / h };

  const doors: AnalysisDoor[] = [];
  const windows: AnalysisWindow[] = [];
  for (const c of bridged) {
    const g = c.gap;
    const a = sideRoom(g, -1);
    const b = sideRoom(g, 1);
    if (c.kind !== 'window') {
      // An opening between two spaces (a door or a passage). Which way a door swings isn't read:
      // Magic Plan places switches from the opening and the walls around it.
      if (a === b || length(g) < 2 * t) continue;
      const [inner, outer] = a === null ? [b, a] : [a, b];
      doors.push({
        id: `d${doors.length + 1}`,
        hinge: pt(g, g.lo),
        latch: pt(g, g.hi + 1),
        swingsInto: inner,
        sides: [inner, outer],
        isMainEntrance: false,
      });
    } else {
      // Glazing only counts on an outside wall; elsewhere it's a stray line through an opening.
      const typeOf = (id: string | null) => rooms.find((r) => r.id === id)?.type;
      const open = (id: string | null) =>
        id === null || ['outdoor', 'balcony', 'garage'].includes(typeOf(id) ?? '');
      if (!open(a) && !open(b)) continue;
      const inside = [a, b].find((id) => id && typeOf(id) !== 'outdoor') ?? a ?? b;
      windows.push({
        id: `w${windows.length + 1}`,
        start: pt(g, g.lo),
        end: pt(g, g.hi + 1),
        roomId: inside ?? null,
      });
    }
  }

  const entrance = pickEntrance(doors, rooms);
  if (entrance) entrance.isMainEntrance = true;

  const issues: string[] = [];
  if (rooms.length < 2)
    issues.push('Only found 1 room. Check that the drawing shows the walls clearly.');
  if (unnamed.size > 0) {
    issues.push(
      unnamed.size === 1
        ? '1 room had no name on the drawing, so it was named by its size and shape.'
        : `${unnamed.size} rooms had no name on the drawing, so they were named by their size and shape.`,
    );
  }
  if (unsure.size > 0) {
    const names = rooms.filter((r) => unsure.has(r.id)).map((r) => r.name);
    issues.push(`Some room names were hard to read (${names.join(', ')}).`);
  }
  if (imageWidthMetres === null)
    issues.push('Couldn’t work out the drawing’s scale, so sizes are estimated.');

  return { analysis: { rooms, doors, windows, imageWidthMetres }, issues };
}

const length = (g: Gap) => g.hi - g.lo + 1;

/** A gap with a door swing drawn in it, glazing (a window), or neither (a plain opening). */
interface Classified {
  gap: Gap;
  kind: 'door' | 'window' | 'opening';
}

function classify(walls: Walls, g: Gap): Classified {
  if (doorSwing(walls, g)) return { gap: g, kind: 'door' };
  return { gap: g, kind: g.lined >= 0.6 ? 'window' : 'opening' };
}

/**
 * Which way a door in this gap swings, judged by the quarter-circle arc and the leaf line drawn
 * from the hinge. Tries both hinge ends on both sides of the wall; null when no swing is drawn.
 */
function doorSwing(walls: Walls, g: Gap): Swing | null {
  const { ink, width: w, height: h, thickness: t } = walls;
  const r = length(g);
  if (r < 2 * t || r > 25 * t) return null;
  const centre = (g.b0 + g.b1 + 1) / 2;
  const tol = Math.max(3, Math.round(r * 0.08));
  const hit = (along: number, across: number, rad: number) => {
    const [cx, cy] = g.axis === 'h' ? [along, across] : [across, along];
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      if (y < 0 || y >= h) continue;
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        if (x >= 0 && x < w && ink[y * w + x]) return true;
      }
    }
    return false;
  };

  let best: { swing: Swing; score: number } | null = null;
  for (const hinge of ['lo', 'hi'] as const) {
    const ha = hinge === 'lo' ? g.lo : g.hi + 1;
    const toward = hinge === 'lo' ? 1 : -1;
    for (const side of [-1, 1] as const) {
      let arc = 0;
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const th = ((15 + (60 * i) / (steps - 1)) * Math.PI) / 180;
        if (hit(ha + toward * Math.cos(th) * r, centre + side * Math.sin(th) * r, tol)) arc++;
      }
      let leaf = 0;
      let n = 0;
      for (let d = t; d <= 0.9 * r; d += Math.max(2, r / 16)) {
        n++;
        if (hit(ha, centre + side * d, 2)) leaf++;
      }
      const score = arc / steps + (n ? leaf / n : 0);
      if (!best || score > best.score) best = { swing: { hinge, side }, score };
    }
  }
  return best && best.score >= 1.2 ? best.swing : null;
}

/** Names rooms from the labels inside them. Returns the ids of rooms no label could name. */
function nameRooms(
  rooms: AnalysisRoom[],
  labels: DrawingLabel[],
  locate: (x: number, y: number) => string | null,
): { unnamed: Set<string>; unsure: Set<string> } {
  const byRoom = new Map<string, (DrawingLabel & { guessed: boolean })[]>();
  for (const l of labels) {
    let text = l.text.replace(/\s+/g, ' ').trim();
    let guessed = false;
    if (l.confidence !== undefined) {
      // Read by OCR: repair near-misses and remember that the name is a best guess.
      const cleaned = cleanLabel(text);
      text = cleaned.text;
      guessed = cleaned.changed || l.confidence < 85;
    }
    text = text.replace(/[\s/&+-]+$/, '').trim();
    if (!/[a-z].*[a-z]/i.test(text) || text.length > 32) continue;
    const id = locate(l.x, l.y);
    if (!id) continue;
    byRoom.set(id, [...(byRoom.get(id) ?? []), { ...l, text, guessed }]);
  }
  const unnamed = new Set<string>();
  const unsure = new Set<string>();
  for (const room of rooms) {
    const found = (byRoom.get(room.id) ?? []).sort((a, b) => a.y - b.y || a.x - b.x);
    const typed = found.filter((l) => roomTypeFromName(l.text));
    if (typed.length === 0) {
      unnamed.add(room.id);
      const plain = found
        .filter((l) => l.text.length <= 24)
        .sort((a, b) => a.text.length - b.text.length)[0];
      if (plain) room.name = plain.text;
      continue;
    }
    if (typed.some((l) => l.guessed)) unsure.add(room.id);
    const types = new Set(typed.map((l) => roomTypeFromName(l.text)!));
    const names = [...new Set(typed.map((l) => l.text))];
    if (types.has('living') && types.has('dining')) {
      room.name = names.join(' / ');
      room.type = 'living-dining';
    } else {
      room.name = names.join(' ');
      room.type = roomTypeFromName(room.name) ?? roomTypeFromName(typed[0]!.text)!;
    }
  }
  return { unnamed, unsure };
}

const NAMES: Partial<Record<RoomType, string>> = {
  'living-dining': 'Living / Dining',
  'master-bedroom': 'Master Bedroom',
  bathroom: 'Bath',
  corridor: 'Corridor',
  bedroom: 'Bedroom',
  store: 'Store',
};

/**
 * Types (and, if still nameless, names) rooms no label described, from size and shape: the
 * largest is the living area, long thin ones are corridors, small ones baths or stores, the rest
 * bedrooms with the largest of those the master.
 */
function guessTypes(
  rooms: AnalysisRoom[],
  unnamed: Set<string>,
  regions: Component[],
  pxPerMetre: number | null,
) {
  const guess = rooms.filter((r) => unnamed.has(r.id));
  if (guess.length === 0) return;
  const region = new Map(rooms.map((r, i) => [r.id, regions[i]!]));
  const area = (r: AnalysisRoom) => region.get(r.id)!.area;
  const total = rooms.reduce((s, r) => s + area(r), 0);
  const largest = [...rooms].sort((a, b) => area(b) - area(a))[0]!;
  const hasLiving = rooms.some((r) => !unnamed.has(r.id) && /living/.test(r.type));
  const bedrooms: AnalysisRoom[] = [];
  for (const r of guess) {
    const c = region.get(r.id)!;
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    const narrow = pxPerMetre ? Math.min(bw, bh) / pxPerMetre <= 1.8 : aspect >= 2.6;
    const share = area(r) / total;
    if (r === largest && !hasLiving) r.type = 'living-dining';
    else if (narrow && aspect >= 2 && share < 0.12) r.type = 'corridor';
    else if (share < 0.035) r.type = aspect >= 1.8 ? 'store' : 'bathroom';
    else if (share < 0.05) r.type = 'bathroom';
    else {
      r.type = 'bedroom';
      bedrooms.push(r);
    }
  }
  const hasMaster = rooms.some((r) => r.type === 'master-bedroom');
  if (!hasMaster && bedrooms.length > 1) {
    bedrooms.sort((a, b) => area(b) - area(a))[0]!.type = 'master-bedroom';
  }
  const count = new Map<RoomType, number>();
  for (const r of guess) {
    if (r.name) continue;
    const n = (count.get(r.type) ?? 0) + 1;
    count.set(r.type, n);
    const base = NAMES[r.type] ?? 'Room';
    const numbered = r.type === 'bedroom' || r.type === 'bathroom' || r.type === 'store';
    r.name = numbered ? `${base} ${n}` : base;
  }
}

/**
 * The front door: a door from outside into the foyer, else into a living area, else any door from
 * the true outside (not a terrace or garden) into a shared room.
 */
function pickEntrance(doors: AnalysisDoor[], rooms: AnalysisRoom[]): AnalysisDoor | undefined {
  const typeOf = (id: string | null) => rooms.find((r) => r.id === id)?.type;
  const outside = (id: string | null) =>
    id === null || typeOf(id) === 'outdoor' || typeOf(id) === 'garage';
  const inner = (d: AnalysisDoor) => d.sides.find((s) => !outside(s)) ?? null;
  const external = doors.filter((d) => d.sides.some(outside) && inner(d));
  return (
    external.find((d) => typeOf(inner(d)) === 'foyer') ??
    external.find((d) => /living/.test(typeOf(inner(d)) ?? '')) ??
    external.find(
      (d) =>
        d.sides.includes(null) &&
        !['bedroom', 'master-bedroom', 'bathroom', 'utility', 'store', 'balcony'].includes(
          typeOf(inner(d)) ?? '',
        ),
    )
  );
}
