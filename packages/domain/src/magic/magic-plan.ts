/**
 * Magic Plan: places smart-home devices and lights on a plan from a floor analysis, using fixed
 * planning rules so results are predictable and explainable.
 *
 * Rooms come with a type (from the built-in sample analyses or a vision model) or as 'other'
 * (read on this computer, unnamed); 'other' rooms are planned by size and shape.
 *
 * Rules in brief
 * - Switches: inside the room, on the wall beside the opening into it, at the end with more wall
 *   (doors are hung against the nearer side wall, so that is the handle side and the open door
 *   never hides the switch). Which way a door swings is not needed. Bathrooms and balconies are switched from outside their door. Walkways
 *   (corridors, foyers, stairs) get a one-gang switch at each opening to another walkway or living
 *   space. Gangs follow the number of lighting circuits in the room (1–4).
 * - Lights, following Singapore renovation practice: downlights in a symmetric grid 0.6 m or more
 *   off the walls (about 1.5 m apart in living areas, 1.4 m in bedrooms), capped at roughly one
 *   per 1.5 m² so ceilings aren't over-lit, and lined up across adjoining rooms. Bedrooms keep the
 *   bed's pillow zone clear; kitchens get a row over the worktop and an under-cabinet strip;
 *   corridors a single centre row; bathrooms 1–3; service yards, stores and balconies one surface
 *   light; the household shelter exactly one surface light (it may not be hacked). LED coves in
 *   living spaces and the master bedroom (with fewer downlights), a pendant over dining, and track
 *   only in elongated spaces (long, narrow walkways). A ceiling fan with light in living areas and
 *   bedrooms (52" in living and master, 46" in common bedrooms), with downlights kept clear of the
 *   blades by 0.5 m; the fan takes a gang on the room's switch.
 * - One switch per room, by its door. Bathrooms, stores, the shelter and service yards are switched
 *   from outside.
 * - Control panels at the main entrance and in the master bedroom; curtains only at the windows of
 *   living rooms, bedrooms and the study; a router and gateway in the main living space plus mesh
 *   nodes for larger homes;
 *   optional aircon controllers, sensors, camera and lock.
 */
import { categoryById, type CategoryId } from '../categories.ts';
import { newId } from '../ids.ts';
import type { PlanElement, Pt } from '../types.ts';
import type { FloorAnalysis, RoomType } from './analysis.ts';

export interface VariantHint {
  /** Switch gangs wanted (1–4). */
  gangs?: number;
  /** A wide window (double curtain track). */
  wide?: boolean;
  /** Ceiling fan sweep wanted, in inches (46 for common bedrooms, 52 for living and master). */
  fanInches?: number;
  role?: 'router' | 'mesh' | 'door-sensor' | 'motion-sensor' | 'indoor-camera';
}

/** Chooses the catalogue variant for a category (and hint); null when the catalogue has none. */
export type VariantPick = (categoryId: CategoryId, hint?: VariantHint) => string | null;

/** Categories Magic Plan can place, in the fixed category order, with whether they start ticked. */
export const MAGIC_CATEGORIES: readonly { id: CategoryId; defaultOn: boolean; note?: string }[] = [
  { id: 'smart-switches', defaultOn: true },
  { id: 'control-panels', defaultOn: true },
  { id: 'curtains-blinds', defaultOn: true },
  { id: 'aircon-controllers', defaultOn: false },
  { id: 'gateways', defaultOn: true },
  { id: 'sensors', defaultOn: false },
  { id: 'cameras', defaultOn: false },
  { id: 'network-devices', defaultOn: true },
  { id: 'smart-locks', defaultOn: false },
  { id: 'downlights', defaultOn: true },
  { id: 'surface-lights', defaultOn: true },
  { id: 'track-lights', defaultOn: true, note: 'Only in long, narrow spaces' },
  { id: 'led-strips', defaultOn: true },
  { id: 'pendant-lights', defaultOn: true },
  { id: 'ceiling-fans', defaultOn: true },
];

export interface MagicPlanInput {
  analysis: FloorAnalysis;
  /** Plan sheet in plan units (width 1000). */
  sheet: { width: number; height: number };
  categories: CategoryId[];
  pick: VariantPick;
}

export interface Placement {
  elementId: string;
  categoryId: CategoryId;
  roomId: string | null;
  /** True when the element belongs on the Lighting Plan. */
  lighting: boolean;
  /** For switch plates that control more than one room: every room switched. */
  roomIds?: string[];
}

export interface MagicPlanResult {
  smartHome: PlanElement[];
  lighting: PlanElement[];
  placements: Placement[];
  warnings: string[];
  /** Plan units per metre used for spacing; estimated when the drawing gave no scale. */
  unitsPerMetre: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const WALKWAYS: RoomType[] = ['corridor', 'foyer', 'staircase'];
const LIVING: RoomType[] = ['living', 'living-dining', 'family', 'dining'];
const SWITCHED_FROM_OUTSIDE: RoomType[] = ['bathroom', 'balcony', 'store', 'utility'];
const SURFACE_ROOMS: RoomType[] = ['balcony', 'utility', 'store', 'staircase', 'garage'];
/** Smart curtains go in living rooms, bedrooms and the study, and nowhere else. */
const CURTAIN_ROOMS: RoomType[] = ['living', 'living-dining', 'bedroom', 'master-bedroom', 'study'];
const AIRCON_ROOMS: RoomType[] = [
  'living',
  'living-dining',
  'family',
  'bedroom',
  'master-bedroom',
  'study',
];
const FAN_ROOMS: RoomType[] = [
  'living',
  'living-dining',
  'family',
  'bedroom',
  'master-bedroom',
  'study',
];
/** Rooms whose downlights should line up with each other where the rooms meet. */
const ALIGNED_ROOMS: RoomType[] = [...LIVING, 'corridor', 'foyer', 'kitchen', 'study'];
/** Household shelters may not be hacked or drilled: one surface light, no false ceiling. */
const isShelter = (r: { type: RoomType; name: string }) =>
  r.type === 'store' && /shelter|bunker|household/i.test(r.name);

const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const unit = (a: Pt, b: Pt): Pt => {
  const d = dist(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};
const centre = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const contains = (r: Rect, p: Pt) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function magicPlan({ analysis, sheet, categories, pick }: MagicPlanInput): MagicPlanResult {
  const want = new Set(categories);
  const warnings: string[] = [];
  const W = sheet.width;
  const H = sheet.height;
  const toUnits = (p: Pt): Pt => ({ x: p.x * W, y: p.y * H });

  const rooms = analysis.rooms.map((r) => ({
    ...r,
    rect: { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H },
  }));
  type Room = (typeof rooms)[number];
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const area = (r: Room) => r.rect.w * r.rect.h;
  // An odd-shaped room comes as its main box plus parts (`partOf` its id). Lights go in every part;
  // the room still gets one switch, one fan, one count of lights and strips for its whole floor.
  /** The room a box belongs to: its own id, or the room it's a part of. */
  const gid = (r: { id: string; partOf?: string | undefined }) => r.partOf ?? r.id;
  const groupOfId = (id: string) => byId.get(id)?.partOf ?? id;
  const membersOf = (room: Room) => rooms.filter((r) => gid(r) === gid(room));
  const floorOf = (room: Room) => membersOf(room).reduce((s, r) => s + area(r), 0);
  const sameRoom = (a: Room | undefined, b: Room) => a !== undefined && gid(a) === gid(b);

  // --- scale -------------------------------------------------------------------------------------
  const doors = analysis.doors.map((d) => ({
    ...d,
    hingeU: toUnits(d.hinge),
    latchU: toUnits(d.latch),
  }));
  type Door = (typeof doors)[number];
  let u: number;
  if (analysis.imageWidthMetres) u = W / analysis.imageWidthMetres;
  else {
    const widths = doors
      .map((d) => dist(d.hingeU, d.latchU))
      .filter((w) => w > 0)
      .sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)];
    u = median ? median / 0.85 : W / 15;
    warnings.push(
      'The drawing has no readable scale, so spacing was estimated from door widths. Check light spacing and LED lengths.',
    );
  }
  const m = (metres: number) => metres * u;

  // Rooms read without a name are planned by size and shape alone: narrow ones as walkways, tiny
  // ones as stores, small ones like bathrooms (switched from outside, a light or two), the largest
  // as the living area and the rest like bedrooms (a fan, a downlight grid, curtains).
  const unnamedIndoor = rooms.filter((r) => r.type === 'other');
  const largestRoom = [...rooms]
    .filter((r) => r.type !== 'outdoor')
    .sort((a, b) => area(b) - area(a))[0];
  for (const r of unnamedIndoor) r.type = planAs(r);
  function planAs(r: Room): RoomType {
    const areaM2 = area(r) / (u * u);
    const short = Math.min(r.rect.w, r.rect.h);
    const aspect = Math.max(r.rect.w, r.rect.h) / short;
    if (short <= m(1.8) && aspect >= 2) return 'corridor';
    if (areaM2 < 2.5) return 'store';
    if (areaM2 < 6) return 'bathroom';
    if (r === largestRoom && !rooms.some((x) => LIVING.includes(x.type))) return 'living';
    return 'bedroom';
  }

  /** The room a point belongs to: the smallest room outline containing it. */
  const owner = (p: Pt): Room | undefined => {
    let best: Room | undefined;
    for (const r of rooms) if (contains(r.rect, p) && (!best || area(r) < area(best))) best = r;
    return best;
  };
  const clamp = (p: Pt): Pt => ({
    x: round1(Math.min(W - 2, Math.max(2, p.x))),
    y: round1(Math.min(H - 2, Math.max(2, p.y))),
  });

  // --- output ------------------------------------------------------------------------------------
  const smartHome: PlanElement[] = [];
  const lighting: PlanElement[] = [];
  const placements: Placement[] = [];
  const emit = (
    el: PlanElement,
    categoryId: CategoryId,
    roomId: string | null,
    roomIds?: string[],
  ) => {
    const isLighting = categoryById(categoryId).planType === 'lighting';
    (isLighting ? lighting : smartHome).push(el);
    // Whatever lands in part of a room is credited to the room.
    const ids = roomIds && [...new Set(roomIds.map(groupOfId))];
    placements.push({
      elementId: el.id,
      categoryId,
      roomId: roomId && groupOfId(roomId),
      lighting: isLighting,
      ...(ids && ids.length > 1 ? { roomIds: ids } : {}),
    });
  };
  const missing = new Set<CategoryId>();
  const markerAt = (
    categoryId: CategoryId,
    at: Pt,
    roomId: string | null,
    hint?: VariantHint,
    rotation = 0,
  ) => {
    const variantId = pick(categoryId, hint);
    if (!variantId) {
      missing.add(categoryId);
      return;
    }
    emit(
      { kind: 'marker', id: newId('el'), z: 0, variantId, ...clamp(at), rotation, label: '' },
      categoryId,
      roomId,
    );
  };

  // --- lighting ------------------------------------------------------------------------------------
  /** Evenly spaced positions along one side, `offset` clear of each end; one centred if it won't fit. */
  const axis = (start: number, len: number, spacing: number, offset: number): number[] => {
    const usable = len - 2 * offset;
    if (usable < spacing * 0.5) return [start + len / 2];
    const n = Math.floor(usable / spacing) + 1;
    if (n === 1) return [start + len / 2];
    return Array.from({ length: n }, (_, i) => start + offset + (usable * i) / (n - 1));
  };

  /**
   * A symmetric grid of light positions inside the room, at least `offset` from the walls, widened
   * until it stays under `maxCount`. Points over rooms drawn inside this one are dropped.
   */
  const grid = (room: Room, spacing: number, offset: number, maxCount: number): Pt[] => {
    const r = room.rect;
    let s = spacing;
    let pts: Pt[] = [];
    for (let tries = 0; tries < 12; tries++) {
      const off = Math.min(Math.max(offset, s / 2), r.w / 2, r.h / 2);
      const offY = Math.min(Math.max(offset, s / 2), r.h / 2);
      const xs = axis(r.x, r.w, s, off);
      const ys = axis(r.y, r.h, s, offY);
      pts = xs.flatMap((x) => ys.map((y) => ({ x, y })));
      if (pts.length <= Math.max(1, maxCount)) break;
      s *= 1.12;
    }
    const own = pts.filter((p) => owner(p)?.id === room.id);
    if (own.length) return own;
    const c = centre(r);
    return owner(c)?.id === room.id ? [c] : [];
  };

  /** A single row along the room's long axis (corridors, bathrooms, small rooms). */
  const row = (room: Room, spacing: number, endOffset: number, maxCount: number): Pt[] => {
    const r = room.rect;
    const horizontal = r.w >= r.h;
    const along = horizontal
      ? axis(r.x, r.w, spacing, endOffset)
      : axis(r.y, r.h, spacing, endOffset);
    const pick =
      along.length > maxCount
        ? axis(
            horizontal ? r.x : r.y,
            horizontal ? r.w : r.h,
            ((horizontal ? r.w : r.h) - 2 * endOffset) / Math.max(1, maxCount - 1),
            endOffset,
          ).slice(0, maxCount)
        : along;
    return pick
      .map((v) => (horizontal ? { x: v, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: v }))
      .filter((p) => owner(p)?.id === room.id);
  };

  type Side = { from: Pt; to: Pt; inward: Pt; length: number };
  /** The room's four walls, each with the direction pointing into the room. */
  const sidesOf = (room: Room): Side[] => {
    const { x, y, w, h } = room.rect;
    return [
      { from: { x, y }, to: { x: x + w, y }, inward: { x: 0, y: 1 }, length: w },
      { from: { x, y: y + h }, to: { x: x + w, y: y + h }, inward: { x: 0, y: -1 }, length: w },
      { from: { x, y }, to: { x, y: y + h }, inward: { x: 1, y: 0 }, length: h },
      { from: { x: x + w, y }, to: { x: x + w, y: y + h }, inward: { x: -1, y: 0 }, length: h },
    ];
  };
  /** True when a point lies on (near) a wall of the room. */
  const onSide = (side: Side, p: Pt) => {
    const horizontal = side.from.y === side.to.y;
    const near = m(0.35);
    return horizontal
      ? Math.abs(p.y - side.from.y) < near && p.x >= side.from.x - near && p.x <= side.to.x + near
      : Math.abs(p.x - side.from.x) < near && p.y >= side.from.y - near && p.y <= side.to.y + near;
  };
  const opensOn = (room: Room, side: Side) =>
    doors.some(
      (d) =>
        d.sides.includes(room.id) &&
        onSide(side, { x: (d.hingeU.x + d.latchU.x) / 2, y: (d.hingeU.y + d.latchU.y) / 2 }),
    );

  /** True when one of the room's windows lies along this wall. */
  const glazedOn = (room: Room, side: Side) =>
    analysis.windows.some(
      (wd) =>
        (wd.roomId === null || wd.roomId === room.id) &&
        onSide(side, {
          x: ((wd.start.x + wd.end.x) / 2) * W,
          y: ((wd.start.y + wd.end.y) / 2) * H,
        }),
    );

  const along = (sd: Side) => unit(sd.from, sd.to);
  const midOf = (sd: Side) => ({ x: (sd.from.x + sd.to.x) / 2, y: (sd.from.y + sd.to.y) / 2 });

  const elongated = (room: Room) => {
    const long = Math.max(room.rect.w, room.rect.h);
    const short = Math.min(room.rect.w, room.rect.h);
    return room.type !== 'bathroom' && long >= m(3.5) && long / short >= 2.8;
  };

  const circuits = new Map<string, Set<CategoryId>>();
  const lit = (room: Room, categoryId: CategoryId) => {
    const set = circuits.get(gid(room)) ?? new Set<CategoryId>();
    set.add(categoryId);
    circuits.set(gid(room), set);
  };

  // Main entrance and its side of the home.
  const entrance = doors.find((d) => d.isMainEntrance);
  const inside = (d: Door) =>
    d.sides.map((s) => (s ? byId.get(s) : undefined)).find((r) => r && r.type !== 'outdoor');
  const entranceRoom = entrance ? inside(entrance) : undefined;
  if (!entrance) {
    warnings.push(
      'Couldn’t find the front entrance on this drawing (normal for upper floors), so the control panel went in the main living space.',
    );
  }

  const queued: { categoryId: CategoryId; at: Pt; room: Room }[] = [];
  for (const room of rooms) {
    if (room.type === 'outdoor') continue;
    const r = room.rect;
    const surfaceRoom = SURFACE_ROOMS.includes(room.type) || isShelter(room);
    const main: CategoryId | null = surfaceRoom
      ? want.has('surface-lights')
        ? 'surface-lights'
        : want.has('downlights')
          ? 'downlights'
          : null
      : want.has('downlights')
        ? 'downlights'
        : want.has('surface-lights')
          ? 'surface-lights'
          : null;

    // Elongated walkways and galleries: a track down the middle instead of a row of downlights.
    if (
      want.has('track-lights') &&
      elongated(room) &&
      (WALKWAYS.includes(room.type) || room.type === 'other')
    ) {
      const horizontal = r.w >= r.h;
      const inset = m(0.6);
      const a = horizontal
        ? { x: r.x + inset, y: r.y + r.h / 2 }
        : { x: r.x + r.w / 2, y: r.y + inset };
      const b = horizontal
        ? { x: r.x + r.w - inset, y: r.y + r.h / 2 }
        : { x: r.x + r.w / 2, y: r.y + r.h - inset };
      const variantId = pick('track-lights');
      if (variantId) {
        const heads = Math.max(2, Math.min(8, Math.round(dist(a, b) / m(1.2))));
        emit(
          {
            kind: 'track',
            id: newId('el'),
            z: 0,
            variantId,
            points: [clamp(a), clamp(b)],
            headCount: heads,
            showLabel: true,
          },
          'track-lights',
          room.id,
        );
        lit(room, 'track-lights');
      } else missing.add('track-lights');
    } else if (main) {
      const areaM2 = area(room) / (u * u);
      const fan = fanSpot(room);
      const fanClear = fan ? { at: fan.at, clear: m(fan.inches * 0.0127 + 0.3) } : null;
      const cap = (perM2: number) => Math.max(1, Math.round(areaM2 / perM2));
      // In a room of several parts, the count is for the whole floor, shared out by area.
      const share = (perM2: number, max: number) => {
        const whole = floorOf(room);
        if (whole <= area(room)) return lightsFor(areaM2, perM2, max);
        const total = lightsFor(whole / (u * u), perM2, max);
        return Math.max(1, Math.round((total * area(room)) / whole));
      };
      let pts: Pt[];
      if (isShelter(room)) pts = [centre(r)];
      else if (main === 'surface-lights')
        pts = areaM2 > 8 ? row(room, m(2.4), m(1), 2) : [centre(r)];
      else if (room.type === 'bathroom') pts = row(room, m(1.1), m(0.5), Math.min(3, cap(2.5)));
      else if (WALKWAYS.includes(room.type) && Math.min(r.w, r.h) < m(2))
        pts = row(room, m(1.1), m(0.5), cap(1.2));
      else if (room.type === 'kitchen') pts = kitchenLights(room);
      else if (LIVING.includes(room.type) && room.type !== 'dining')
        pts = spread(room, share(2.5, 12), fanClear);
      else if (room.type === 'master-bedroom') pts = spread(room, share(3.5, 6), fanClear);
      else if (room.type === 'bedroom') pts = spread(room, share(4, 4), fanClear);
      else if (room.type === 'dining' || room.type === 'study')
        pts = spread(room, share(3, 6), fanClear);
      else pts = grid(room, m(1.3), m(0.6), cap(1.5));
      // Leave the dining table to the pendant, and keep clear of the fan's blades.
      const pendantAt = want.has('pendant-lights') && !room.partOf ? diningSpot(room) : null;
      if (pendantAt) pts = pts.filter((p) => dist(p, pendantAt) > m(0.9));
      if (fan) {
        // Downlights must stay clear of the blades; in a room too tight for both, the lights win.
        const clearOfBlades = pts.every((p) => dist(p, fan.at) > m(fan.inches * 0.0127 + 0.3));
        if (clearOfBlades) {
          markerAt('ceiling-fans', fan.at, room.id, { fanInches: fan.inches });
          lit(room, 'ceiling-fans');
        }
      }
      for (const p of pts) queued.push({ categoryId: main, at: p, room });
      if (pts.length) lit(room, main);
    }

    // Pendant over the dining table.
    if (want.has('pendant-lights') && !room.partOf) {
      const at = diningSpot(room);
      if (at) {
        markerAt('pendant-lights', at, room.id);
        lit(room, 'pendant-lights');
      }
    }

    // LED strips in the L-box along the walls: 3–4 in the living room, up to 3 in the master
    // bedroom and up to 2 in other bedrooms, on the walls without the door first.
    // LED strips run close along the walls, in the L-box. Window walls come first: the strip
    // becomes a curtain cove over the curtain track. A living room or bedroom with a window gets
    // at least that one.
    const windowWalls = sidesOf(room).filter((sd) => glazedOn(room, sd));
    const runs = Math.max(
      stripRuns(room),
      windowWalls.length > 0 && CURTAIN_ROOMS.includes(room.type) && area(room) >= m(2.5) * m(2.5)
        ? 1
        : 0,
    );
    if (runs > 0 && want.has('led-strips')) {
      const variantId = pick('led-strips');
      if (variantId) {
        const inset = m(0.3);
        const rank = (sd: Side) => (glazedOn(room, sd) ? 0 : opensOn(room, sd) ? 2 : 1);
        const walls = sidesOf(room)
          .filter((sd) => sd.length > m(1.2))
          .sort((a, b) => rank(a) - rank(b) || b.length - a.length);
        let placed = 0;
        for (const wall of walls) {
          if (placed >= runs) break;
          // A curtain cove only needs to cover the window: 1 m will do there.
          const run = wallRun(room, wall, inset, glazedOn(room, wall) ? m(1) : m(1.5));
          if (!run) continue;
          const [start, end] = run;
          placed++;
          emit(
            {
              kind: 'led-strip',
              id: newId('el'),
              z: 0,
              variantId,
              points: [clamp(start), clamp(end)],
              closed: false,
              smooth: false,
              metres: Math.ceil(dist(start, end) / u / 0.5) * 0.5,
              showLabel: false,
            },
            'led-strips',
            room.id,
          );
          lit(room, 'led-strips');
        }
      } else missing.add('led-strips');
    }

    // Under-cabinet strip along the kitchen's cabinet wall.
    if (want.has('led-strips') && room.type === 'kitchen' && !room.partOf) {
      const wall = cabinetWall(room);
      const dir = along(wall);
      const len = wall.length * 0.75;
      const mid = add(midOf(wall), wall.inward, m(0.4));
      const start = add(mid, dir, -len / 2);
      const end = add(mid, dir, len / 2);
      const variantId = pick('led-strips');
      if (variantId && owner(start)?.id === room.id && owner(end)?.id === room.id) {
        emit(
          {
            kind: 'led-strip',
            id: newId('el'),
            z: 0,
            variantId,
            points: [clamp(start), clamp(end)],
            closed: false,
            smooth: false,
            metres: Math.ceil(len / u / 0.5) * 0.5,
            showLabel: false,
          },
          'led-strips',
          room.id,
        );
        lit(room, 'led-strips');
      }
    }
  }

  // Line downlights up across adjoining living spaces, corridors and kitchens, then place them.
  alignQueued();
  for (const q of queued) markerAt(q.categoryId, q.at, q.room.id);
  const downlightCount = queued.filter((q) => q.categoryId === 'downlights').length;
  const indoorM2 =
    rooms.filter((x) => x.type !== 'outdoor').reduce((sum, x) => sum + area(x), 0) / (u * u);
  if (downlightCount > (indoorM2 / 1.5) * 1.5) {
    warnings.push(
      `${downlightCount} downlights is a lot for about ${Math.round(indoorM2)} m²; consider removing some.`,
    );
  }

  /**
   * Where a ceiling fan goes: the room's centre (the seating half of a living/dining room), sized
   * for the room. Null when fans aren't wanted or the room is too small for one.
   */
  function fanSpot(room: Room): { at: Pt; inches: number } | null {
    if (!want.has('ceiling-fans') || !FAN_ROOMS.includes(room.type) || room.partOf) return null;
    const r = room.rect;
    if (Math.min(r.w, r.h) < m(2.2) || area(room) < m(2.5) * m(2.6)) return null;
    let at = centre(r);
    if (room.type === 'living-dining') {
      const dining = diningSpot(room);
      if (dining) at = { x: 2 * at.x - dining.x, y: 2 * at.y - dining.y };
    }
    if (owner(at)?.id !== room.id) return null;
    const inches = room.type === 'bedroom' || room.type === 'study' ? 46 : 52;
    return { at, inches };
  }

  /**
   * The part of a room clear of rooms drawn inside it (an ensuite in a master bedroom): the
   * largest strip of the room beside the inner room.
   */
  function freeRect(room: Room): Rect {
    const r = room.rect;
    const inner = rooms.find(
      (o) => o !== room && area(o) < area(room) && contains(r, centre(o.rect)),
    );
    if (!inner) return r;
    const i = inner.rect;
    const strips: Rect[] = [
      { x: r.x, y: r.y, w: i.x - r.x, h: r.h },
      { x: i.x + i.w, y: r.y, w: r.x + r.w - (i.x + i.w), h: r.h },
      { x: r.x, y: r.y, w: r.w, h: i.y - r.y },
      { x: r.x, y: i.y + i.h, w: r.w, h: r.y + r.h - (i.y + i.h) },
    ];
    return strips.filter((s) => s.w > 0 && s.h > 0).sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? r;
  }

  /**
   * Downlights for a room of `areaM2`, from the area each light covers, so the count follows the
   * size of the box drawn: a small family corner gets 2, a big living room up to `max`.
   */
  function lightsFor(areaM2: number, m2PerLight: number, max: number): number {
    return clampN(Math.round(areaM2 / m2PerLight), areaM2 < 4 ? 1 : 2, max);
  }

  /**
   * A strip `inset` in from a wall, trimmed to the longest stretch that stays in the room (clear
   * of a toilet drawn inside a bedroom, say). Null when less than `minLength` is left.
   */
  function wallRun(room: Room, wall: Side, inset: number, minLength = m(1.5)): [Pt, Pt] | null {
    const dir = along(wall);
    const base = add(wall.from, wall.inward, inset);
    const steps = Math.max(2, Math.ceil(wall.length / m(0.1)));
    let best: [number, number] | null = null;
    let runStart: number | null = null;
    // Not across the seam where another part of the same room carries on past this wall.
    const others = membersOf(room).filter((o) => o !== room);
    for (let i = 0; i <= steps; i++) {
      const d = inset + ((wall.length - 2 * inset) * i) / steps;
      const at = add(base, dir, d);
      const past = add(at, wall.inward, -(inset + m(0.3)));
      const inside = owner(at)?.id === room.id && !others.some((o) => contains(o.rect, past));
      if (inside && runStart === null) runStart = d;
      const prev = inset + ((wall.length - 2 * inset) * (i - 1)) / steps;
      if ((!inside || i === steps) && runStart !== null) {
        const stop = inside ? d : prev;
        if (!best || stop - runStart > best[1] - best[0]) best = [runStart, stop];
        runStart = null;
      }
    }
    if (!best || best[1] - best[0] < minLength) return null;
    return [add(base, dir, best[0]), add(base, dir, best[1])];
  }

  /** How many LED strip runs a room gets (more downlights, fewer strips). */
  function stripRuns(room: Room): number {
    // A room's runs are counted once, for its whole floor, and placed from its main box.
    if (room.partOf) return 0;
    const areaM2 = floorOf(room) / (u * u);
    if (LIVING.includes(room.type) && room.type !== 'dining')
      return areaM2 >= 20 ? 4 : areaM2 >= 14 ? 3 : areaM2 >= 9 ? 2 : areaM2 >= 5 ? 1 : 0;
    if (room.type === 'master-bedroom') return areaM2 >= 18 ? 3 : areaM2 >= 12 ? 2 : 1;
    if (room.type === 'bedroom') return areaM2 >= 13 ? 2 : areaM2 >= 9 ? 1 : 0;
    return 0;
  }

  /**
   * `count` downlights spread evenly and symmetrically over the room, 0.5 m or more off the walls.
   * With a ceiling fan in the middle they go round the edge of the grid instead (the usual
   * Singapore layout of a central fan ringed by downlights).
   */
  function spread(room: Room, count: number, fan: { at: Pt; clear: number } | null): Pt[] {
    const r = freeRect(room);
    const ring = fan !== null;
    const inset = Math.min(m(0.6), r.w / 4, r.h / 4);
    const iw = r.w - 2 * inset;
    const ih = r.h - 2 * inset;
    const ratio = iw / ih;
    const layout = (nx: number, ny: number): Pt[] => {
      const pts: Pt[] = [];
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const onEdge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
          if (ring && nx >= 2 && ny >= 2 && !onEdge) continue;
          // A ring hugs the inset rectangle's edges; a full grid sits in the middle of each cell.
          const fx = ring && nx >= 2 ? i / (nx - 1) : (i + 0.5) / nx;
          const fy = ring && ny >= 2 ? j / (ny - 1) : (j + 0.5) / ny;
          pts.push({ x: r.x + inset + iw * fx, y: r.y + inset + ih * fy });
        }
      }
      return pts.filter((p) => owner(p)?.id === room.id);
    };
    // Grid shapes whose count is close to the target and whose proportions suit the room; with a
    // fan, only those that keep every light clear of its blades.
    const shapes: { nx: number; ny: number; score: number }[] = [];
    for (let nx = 1; nx <= 6; nx++) {
      for (let ny = 1; ny <= 6; ny++) {
        const n = ring && nx >= 2 && ny >= 2 ? 2 * (nx + ny) - 4 : nx * ny;
        // Stay within one light of the count the room's size calls for.
        if (Math.abs(n - count) > 1) continue;
        shapes.push({
          nx,
          ny,
          score: Math.abs(n - count) * 3 + Math.abs(Math.log(nx / ny / ratio)),
        });
      }
    }
    shapes.sort((a, b) => a.score - b.score);
    for (const { nx, ny } of shapes) {
      const pts = layout(nx, ny);
      if (!fan || pts.every((p) => dist(p, fan.at) > fan.clear)) return pts;
    }
    // Too tight for a fan: keep the lights at the right count (the fan is left out below).
    if (fan) return spread(room, count, null);
    return shapes[0] ? layout(shapes[0].nx, shapes[0].ny) : [];
  }

  /** The wall the kitchen cabinets run along: the longest one without an opening. */
  function cabinetWall(room: Room): Side {
    const sides = sidesOf(room).sort((a, b) => b.length - a.length);
    return sides.find((sd) => !opensOn(room, sd)) ?? sides[0]!;
  }

  /** Kitchen downlights: a row over the worktop edge, and one along the far wall in a galley. */
  function kitchenLights(room: Room): Pt[] {
    const wall = cabinetWall(room);
    const dir = along(wall);
    const depth = wall.inward.x !== 0 ? room.rect.w : room.rect.h;
    const lineAt = (offset: number) => {
      const base = add(wall.from, wall.inward, offset);
      const start = wall.inward.x !== 0 ? base.y : base.x;
      return axis(start, wall.length, m(1.2), m(0.6)).map((v) =>
        dir.x !== 0 ? { x: v, y: base.y } : { x: base.x, y: v },
      );
    };
    const pts =
      depth >= m(2.6)
        ? [...lineAt(m(0.6)), ...lineAt(depth - m(0.6))]
        : lineAt(Math.min(m(0.6), depth / 2));
    const own = pts.filter((p) => owner(p)?.id === room.id);
    return own.length ? own : [centre(room.rect)];
  }

  /**
   * Snaps downlight rows and columns that nearly line up across adjoining rooms onto one line, as
   * long as every light stays in its own room.
   */
  function alignQueued() {
    const tol = m(0.2);
    const items = queued.filter(
      (q) => q.categoryId === 'downlights' && ALIGNED_ROOMS.includes(q.room.type),
    );
    for (const key of ['x', 'y'] as const) {
      const sorted = [...items].sort((a, b) => a.at[key] - b.at[key]);
      let group: typeof items = [];
      const flush = () => {
        const roomsIn = new Set(group.map((g) => g.room.id));
        if (group.length > 1 && roomsIn.size > 1) {
          const mean = group.reduce((sum, g) => sum + g.at[key], 0) / group.length;
          for (const g of group) {
            const moved = { ...g.at, [key]: mean };
            if (owner(moved)?.id === g.room.id) g.at = moved;
          }
        }
        group = [];
      };
      for (const it of sorted) {
        if (group.length && it.at[key] - group[group.length - 1]!.at[key] > tol) flush();
        group.push(it);
      }
      flush();
    }
  }

  /** Where the dining table is: the dining room's centre, or the far half of a living/dining room. */
  function diningSpot(room: Room): Pt | null {
    const r = room.rect;
    if (room.type === 'dining') return centre(r);
    if (room.type !== 'living-dining') return null;
    const horizontal = r.w >= r.h;
    const halves = horizontal
      ? [centre({ ...r, w: r.w / 2 }), centre({ ...r, x: r.x + r.w / 2, w: r.w / 2 })]
      : [centre({ ...r, h: r.h / 2 }), centre({ ...r, y: r.y + r.h / 2, h: r.h / 2 })];
    // The half away from the entrance is usually the dining end.
    const ref = entrance ? entrance.hingeU : centre(r);
    return dist(halves[0]!, ref) > dist(halves[1]!, ref) ? halves[0]! : halves[1]!;
  }

  // --- switches ----------------------------------------------------------------------------------
  /** The box of `room` (it or one of its parts) that a door opens from. */
  function localSide(door: Door, room: Room): Room {
    const id = door.sides.find((s) => s !== null && groupOfId(s) === gid(room));
    return (id && byId.get(id)) || room;
  }
  /** Wall left in `room` past an end of an opening, walking away from the opening. */
  const wallBeyond = (end: Pt, dir: Pt, room: Room) => {
    const r = room.rect;
    if (Math.abs(dir.x) >= Math.abs(dir.y)) return dir.x > 0 ? r.x + r.w - end.x : end.x - r.x;
    return dir.y > 0 ? r.y + r.h - end.y : end.y - r.y;
  };

  /**
   * A wall position beside an opening, on the given room's side, at the end with more wall (the
   * handle side of a door hung against the nearer side wall). `extra` moves further along the wall
   * (for panels and controllers next to the switch).
   */
  const besideLatch = (door: Door, room: Room, extra = 0): Pt | null => {
    const side = localSide(door, room);
    const a = door.hingeU;
    const b = door.latchU;
    const ab = unit(a, b);
    const ba = { x: -ab.x, y: -ab.y };
    const bFirst = wallBeyond(b, ab, side) >= wallBeyond(a, ba, side);
    const [first, second] = bFirst ? [b, a] : [a, b];
    const along = unit(second, first);
    const normal = { x: -along.y, y: along.x };
    for (const [alongSide, base] of [
      [1, first],
      [-1, second],
    ] as const) {
      const onWall = add(base, along, alongSide * (m(0.25) + extra));
      for (const s of [1, -1]) {
        const p = add(onWall, normal, s * m(0.15));
        if (sameRoom(owner(p), side)) return p;
      }
    }
    return null;
  };

  const doorsOf = (room: Room) =>
    doors.filter((d) => d.sides.some((s) => s !== null && groupOfId(s) === gid(room)));
  const other = (d: Door, room: Room) => {
    const id = d.sides.find((s) => s === null || groupOfId(s) !== gid(room)) ?? null;
    return id ? byId.get(id) : undefined;
  };
  const walkable = (r: Room | undefined) =>
    !r || WALKWAYS.includes(r.type) || LIVING.includes(r.type) || r.type === 'outdoor';
  const gangsFor = (room: Room) => Math.max(1, Math.min(4, circuits.get(room.id)?.size ?? 1));

  // Switch plates are collected first so two rooms switched from the same spot share one plate
  // (e.g. a balcony light on the master bedroom's switch) instead of stacking.
  const plates: { at: Pt; gangs: number; roomIds: string[] }[] = [];
  const addPlate = (at: Pt, gangs: number, roomId: string) => {
    const near = plates.find((p) => dist(p.at, at) < m(0.3));
    if (near) {
      near.gangs = Math.min(4, near.gangs + gangs);
      near.roomIds.push(roomId);
    } else plates.push({ at, gangs, roomIds: [roomId] });
  };

  /** A wall spot just outside a door, beside it at the end with more wall. */
  const outsideDoor = (door: Door, whole: Room): Pt => {
    const room = localSide(door, whole);
    const ab = unit(door.hingeU, door.latchU);
    const ba = { x: -ab.x, y: -ab.y };
    const bFirst = wallBeyond(door.latchU, ab, room) >= wallBeyond(door.hingeU, ba, room);
    const [end, dir] = bFirst ? [door.latchU, ab] : [door.hingeU, ba];
    const mid = { x: (door.hingeU.x + door.latchU.x) / 2, y: (door.hingeU.y + door.latchU.y) / 2 };
    const n = { x: -ab.y, y: ab.x };
    const outward = sameRoom(owner(add(mid, n, m(0.15))), room) ? { x: -n.x, y: -n.y } : n;
    return add(add(end, dir, m(0.25)), outward, m(0.15));
  };

  const switchAnchors = new Map<string, { door: Door; side: Room }>();
  const placeSwitch = (room: Room, door: Door, side: Room, gangs: number) => {
    const at = besideLatch(door, side);
    if (!at) return false;
    addPlate(at, gangs, room.id);
    if (!switchAnchors.has(room.id)) switchAnchors.set(room.id, { door, side });
    return true;
  };

  const homeCentre = (() => {
    const indoor = rooms.filter((r) => r.type !== 'outdoor');
    return {
      x: indoor.reduce((s, r) => s + centre(r.rect).x, 0) / indoor.length,
      y: indoor.reduce((s, r) => s + centre(r.rect).y, 0) / indoor.length,
    };
  })();

  /**
   * For rooms without a usable door (open-plan kitchens and living rooms, doorless balconies): the
   * wall point nearest the entrance or the home's centre, stepped into the next room for spaces
   * that are switched from outside.
   */
  const openPlanSwitch = (room: Room) => {
    const target = entrance?.hingeU ?? homeCentre;
    const r = room.rect;
    const inset = m(0.15);
    const p = {
      x: Math.min(r.x + r.w - inset, Math.max(r.x + inset, target.x)),
      y: Math.min(r.y + r.h - inset, Math.max(r.y + inset, target.y)),
    };
    if (SWITCHED_FROM_OUTSIDE.includes(room.type)) {
      const step = add(p, unit(p, target), m(0.3));
      const next = owner(step);
      if (next && next.id !== room.id && next.type !== 'outdoor')
        addPlate(step, gangsFor(room), room.id);
    } else if (sameRoom(owner(p), room)) addPlate(p, gangsFor(room), room.id);
  };

  // When lights are being planned, rooms that got none need no switch; otherwise switch every room.
  const planningLights = categories.some((c) => categoryById(c).planType === 'lighting');
  for (const room of rooms) {
    if (room.partOf) continue;
    if (room.type === 'outdoor' || (planningLights && !circuits.has(room.id))) continue;
    const ds = doorsOf(room);

    if (SWITCHED_FROM_OUTSIDE.includes(room.type)) {
      // Switch on the wall outside the door, in the room you approach from.
      const door = ds[0];
      const side = door && other(door, room);
      if (door && side && side.type !== 'outdoor') placeSwitch(room, door, side, gangsFor(room));
      else if (door && !side) {
        // The space outside the door wasn't outlined: switch on the wall just outside it anyway.
        const at = outsideDoor(door, room);
        addPlate(at, gangsFor(room), room.id);
      } else openPlanSwitch(room);
      continue;
    }

    if (ds.length && WALKWAYS.includes(room.type)) {
      // One switch, where the walkway is entered from a living space or the entrance.
      const d = ds.find((x) => walkable(other(x, room))) ?? ds[0]!;
      placeSwitch(room, d, room, 1);
      continue;
    }

    // The door you normally walk in through: the main entrance, else one from a walkway or living
    // space. A living room reached through an opening is switched at that opening, not from a
    // bedroom door.
    const walkIn = ds.find((d) => d.isMainEntrance) ?? ds.find((d) => walkable(other(d, room)));
    if (walkIn) placeSwitch(room, walkIn, room, gangsFor(room));
    else if (ds.length && !LIVING.includes(room.type))
      placeSwitch(room, ds[0]!, room, gangsFor(room));
    else openPlanSwitch(room);
  }

  if (want.has('smart-switches')) {
    for (const plate of plates) {
      const variantId = pick('smart-switches', { gangs: plate.gangs });
      if (!variantId) {
        missing.add('smart-switches');
        break;
      }
      const at = clamp(plate.at);
      const el: PlanElement = {
        kind: 'marker',
        id: newId('el'),
        z: 0,
        variantId,
        ...at,
        rotation: 0,
        label: '',
      };
      // Credit the plate to the room it sits in when that is one of the rooms it switches.
      const home = owner(plate.at)?.id;
      const roomId = plate.roomIds.find((id) => id === home) ?? plate.roomIds[0]!;
      emit(el, 'smart-switches', roomId, plate.roomIds);
    }
  }

  // --- entrance, panels, controllers -----------------------------------------------------------
  const wholeRooms = rooms.filter((r) => !r.partOf);
  const hub =
    wholeRooms.filter((r) => LIVING.includes(r.type)).sort((a, b) => floorOf(b) - floorOf(a))[0] ??
    wholeRooms.filter((r) => r.type !== 'outdoor').sort((a, b) => floorOf(b) - floorOf(a))[0];

  if (want.has('control-panels')) {
    if (entrance && entranceRoom) {
      const at = besideLatch(entrance, entranceRoom, m(0.45));
      if (at) markerAt('control-panels', at, entranceRoom.id);
    } else if (hub) {
      const anchor = switchAnchors.get(hub.id);
      const at = anchor ? besideLatch(anchor.door, anchor.side, m(0.45)) : centre(hub.rect);
      if (at) markerAt('control-panels', at, hub.id);
    }
    const master = wholeRooms.find((r) => r.type === 'master-bedroom');
    const anchor = master && switchAnchors.get(master.id);
    if (master && anchor) {
      const at = besideLatch(anchor.door, anchor.side, m(0.45));
      if (at) markerAt('control-panels', at, master.id);
    }
  }

  if (want.has('aircon-controllers')) {
    for (const room of wholeRooms.filter((r) => AIRCON_ROOMS.includes(r.type))) {
      const anchor = switchAnchors.get(room.id);
      const at = anchor
        ? besideLatch(anchor.door, anchor.side, m(anchor.door.isMainEntrance ? 0.9 : 0.45))
        : null;
      markerAt('aircon-controllers', at ?? centre(room.rect), room.id);
    }
  }

  // --- curtains ----------------------------------------------------------------------------------
  // Only where there's a window: windows are on the outside of the home, so a curtain never lands
  // on a wall onto a corridor or another room.
  if (want.has('curtains-blinds')) {
    for (const w of analysis.windows) {
      const a = toUnits(w.start);
      const b = toUnits(w.end);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const along = unit(a, b);
      const normal = { x: -along.y, y: along.x };
      const sides = [add(mid, normal, m(0.25)), add(mid, normal, -m(0.25))];
      const at = sides.find((p) => {
        const r = owner(p);
        return r && (w.roomId ? r.id === w.roomId : true) && CURTAIN_ROOMS.includes(r.type);
      });
      if (!at) continue;
      // The track runs the length of the window, just inside the room.
      const variantId = pick('curtains-blinds', { wide: dist(a, b) >= m(2.4) });
      if (!variantId) {
        missing.add('curtains-blinds');
        continue;
      }
      const inward = { x: at.x - mid.x, y: at.y - mid.y };
      emit(
        {
          kind: 'curtain',
          id: newId('el'),
          z: 0,
          variantId,
          points: [clamp(add(a, inward)), clamp(add(b, inward))],
        },
        'curtains-blinds',
        owner(at)!.id,
      );
    }
  }

  // --- network and gateway -----------------------------------------------------------------------
  if (hub && (want.has('network-devices') || want.has('gateways'))) {
    // Router on the hub room's wall closest to the middle of the home, for even coverage.
    const r = hub.rect;
    const inset = m(0.3);
    const at = {
      x: Math.min(r.x + r.w - inset, Math.max(r.x + inset, homeCentre.x)),
      y: Math.min(r.y + r.h - inset, Math.max(r.y + inset, homeCentre.y)),
    };
    if (want.has('network-devices')) markerAt('network-devices', at, hub.id, { role: 'router' });
    if (want.has('gateways')) markerAt('gateways', add(at, { x: 1, y: 0 }, m(0.45)), hub.id);

    if (want.has('network-devices')) {
      const indoorArea =
        rooms.filter((x) => x.type !== 'outdoor').reduce((s, x) => s + area(x), 0) / (u * u);
      const nodes = Math.max(0, Math.ceil(indoorArea / 70) - 1);
      const aps: Pt[] = [at];
      const candidates = wholeRooms.filter(
        (x) =>
          !['outdoor', 'balcony', 'garage', 'bathroom', 'store', 'utility'].includes(x.type) &&
          x.id !== hub.id,
      );
      for (let i = 0; i < nodes && candidates.length; i++) {
        candidates.sort(
          (a, b) =>
            Math.min(...aps.map((p) => dist(p, centre(b.rect)))) -
            Math.min(...aps.map((p) => dist(p, centre(a.rect)))),
        );
        const next = candidates.shift()!;
        const c = centre(next.rect);
        aps.push(c);
        markerAt('network-devices', add(c, { x: 0, y: -1 }, m(0.4)), next.id, { role: 'mesh' });
      }
    }
  }

  // --- sensors, camera, lock ---------------------------------------------------------------------
  if (want.has('sensors')) {
    if (entrance && entranceRoom) {
      const mid = {
        x: (entrance.hingeU.x + entrance.latchU.x) / 2,
        y: (entrance.hingeU.y + entrance.latchU.y) / 2,
      };
      const along = unit(entrance.hingeU, entrance.latchU);
      const normal = { x: -along.y, y: along.x };
      const at = [add(mid, normal, m(0.3)), add(mid, normal, -m(0.3))].find(
        (p) => owner(p)?.id === entranceRoom.id,
      );
      if (at) markerAt('sensors', at, entranceRoom.id, { role: 'door-sensor' });
    }
    for (const room of wholeRooms.filter(
      (r) => WALKWAYS.includes(r.type) && r.type !== 'staircase',
    )) {
      markerAt('sensors', centre(room.rect), room.id, { role: 'motion-sensor' });
    }
  }
  if (want.has('cameras') && entrance && entranceRoom) {
    // Inside the entrance space, in the corner farthest from the door, looking back at it.
    const r = entranceRoom.rect;
    const inset = m(0.3);
    const corners = [
      { x: r.x + inset, y: r.y + inset },
      { x: r.x + r.w - inset, y: r.y + inset },
      { x: r.x + inset, y: r.y + r.h - inset },
      { x: r.x + r.w - inset, y: r.y + r.h - inset },
    ].filter((c) => owner(c)?.id === entranceRoom.id);
    const far = corners.sort((a, b) => dist(b, entrance.hingeU) - dist(a, entrance.hingeU))[0];
    if (far) markerAt('cameras', far, entranceRoom.id, { role: 'indoor-camera' });
  }
  if (want.has('smart-locks') && entrance && entranceRoom) {
    const along = unit(entrance.hingeU, entrance.latchU);
    const normal = { x: -along.y, y: along.x };
    const nearLatch = add(entrance.latchU, along, -m(0.1));
    const at = [add(nearLatch, normal, m(0.12)), add(nearLatch, normal, -m(0.12))].find(
      (p) => owner(p)?.id === entranceRoom.id,
    );
    if (at) markerAt('smart-locks', at, entranceRoom.id);
  }

  for (const c of missing)
    warnings.push(
      `The catalogue has no visible ${categoryById(c).name} to use, so none were placed.`,
    );
  if (want.has('led-strips') && placements.some((p) => p.categoryId === 'led-strips')) {
    warnings.push('LED strip lengths are estimates from the drawing. Check them before quoting.');
  }
  return { smartHome, lighting, placements, warnings, unitsPerMetre: u };
}
