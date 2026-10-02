/**
 * Magic Plan: places smart-home devices and lights on a plan from a floor analysis, using fixed
 * planning rules so results are predictable and explainable.
 *
 * Rules in brief
 * - Switches: inside the room, on the wall beside the latch (handle) end of its door, so the open
 *   door never hides them. Bathrooms and balconies are switched from outside their door. Walkways
 *   (corridors, foyers, stairs) get a one-gang switch at each opening to another walkway or living
 *   space. Gangs follow the number of lighting circuits in the room (1–4).
 * - Lights: downlights on a regular grid (surface lights in balconies, stores, utility areas and on
 *   stairs); LED coves around living spaces and the master bedroom; an under-cabinet strip in
 *   kitchens; a pendant over dining. Track only in elongated spaces (long, narrow walkways).
 * - Control panels at the main entrance and in the master bedroom; curtains at living and bedroom
 *   windows; a router and gateway in the main living space plus mesh nodes for larger homes;
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
const SWITCHED_FROM_OUTSIDE: RoomType[] = ['bathroom', 'balcony'];
const SURFACE_ROOMS: RoomType[] = ['balcony', 'utility', 'store', 'staircase', 'garage'];
const CURTAIN_ROOMS: RoomType[] = [
  'living',
  'living-dining',
  'dining',
  'family',
  'bedroom',
  'master-bedroom',
  'study',
];
const AIRCON_ROOMS: RoomType[] = [
  'living',
  'living-dining',
  'family',
  'bedroom',
  'master-bedroom',
  'study',
];
const COVE_ROOMS: RoomType[] = ['living', 'living-dining', 'family', 'master-bedroom'];

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
    placements.push({
      elementId: el.id,
      categoryId,
      roomId,
      lighting: isLighting,
      ...(roomIds && roomIds.length > 1 ? { roomIds } : {}),
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
  /** Points on a grid inside the room (keeping clear of walls and of rooms drawn inside it). */
  const grid = (room: Room, spacing: number, maxPerSide = 8): Pt[] => {
    const r = room.rect;
    const margin = Math.min(m(0.5), r.w * 0.2, r.h * 0.2);
    const iw = r.w - margin * 2;
    const ih = r.h - margin * 2;
    const nx = Math.max(1, Math.min(maxPerSide, Math.round(iw / spacing)));
    const ny = Math.max(1, Math.min(maxPerSide, Math.round(ih / spacing)));
    const pts: Pt[] = [];
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        pts.push({
          x: r.x + margin + (iw * (i + 0.5)) / nx,
          y: r.y + margin + (ih * (j + 0.5)) / ny,
        });
    const own = pts.filter((p) => owner(p)?.id === room.id);
    if (own.length) return own;
    const c = centre(r);
    return owner(c)?.id === room.id ? [c] : [];
  };

  const elongated = (room: Room) => {
    const long = Math.max(room.rect.w, room.rect.h);
    const short = Math.min(room.rect.w, room.rect.h);
    return room.type !== 'bathroom' && long >= m(3.5) && long / short >= 2.8;
  };

  const circuits = new Map<string, Set<CategoryId>>();
  const lit = (room: Room, categoryId: CategoryId) => {
    const set = circuits.get(room.id) ?? new Set<CategoryId>();
    set.add(categoryId);
    circuits.set(room.id, set);
  };

  // Main entrance and its side of the home.
  const entrance = doors.find((d) => d.isMainEntrance);
  const inside = (d: Door) =>
    d.sides.map((s) => (s ? byId.get(s) : undefined)).find((r) => r && r.type !== 'outdoor');
  const entranceRoom = entrance ? inside(entrance) : undefined;
  if (!entrance) {
    warnings.push(
      'No front door on this drawing (normal for upper floors), so the control panel went in the main living space.',
    );
  }

  for (const room of rooms) {
    if (room.type === 'outdoor') continue;
    const r = room.rect;
    const surfaceRoom = SURFACE_ROOMS.includes(room.type);
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
      const spacing =
        main === 'surface-lights' ? m(2.4) : room.type === 'bathroom' ? m(1.4) : m(1.6);
      let pts = grid(room, spacing, main === 'surface-lights' ? 3 : 8);
      // Leave the dining table to the pendant.
      const pendantAt = want.has('pendant-lights') ? diningSpot(room) : null;
      if (pendantAt) pts = pts.filter((p) => dist(p, pendantAt) > m(0.9));
      for (const p of pts) markerAt(main, p, room.id);
      if (pts.length) lit(room, main);
    }

    // Pendant over the dining table.
    if (want.has('pendant-lights')) {
      const at = diningSpot(room);
      if (at) {
        markerAt('pendant-lights', at, room.id);
        lit(room, 'pendant-lights');
      }
    }

    // LED cove around living spaces and the master bedroom.
    if (want.has('led-strips') && COVE_ROOMS.includes(room.type) && area(room) >= m(3) * m(3)) {
      const inset = m(0.45);
      const corners = [
        { x: r.x + inset, y: r.y + inset },
        { x: r.x + r.w - inset, y: r.y + inset },
        { x: r.x + r.w - inset, y: r.y + r.h - inset },
        { x: r.x + inset, y: r.y + r.h - inset },
      ];
      // Skip the cove when a room drawn inside this one (an ensuite) would sit under it.
      const clear = corners.every((c) => owner(c)?.id === room.id);
      const variantId = pick('led-strips');
      if (clear && variantId) {
        const metres = Math.ceil((2 * (r.w + r.h - 4 * inset)) / u / 0.5) * 0.5;
        emit(
          {
            kind: 'led-strip',
            id: newId('el'),
            z: 0,
            variantId,
            points: corners.map(clamp),
            closed: true,
            smooth: false,
            metres,
            showLabel: true,
          },
          'led-strips',
          room.id,
        );
        lit(room, 'led-strips');
      } else if (!variantId) missing.add('led-strips');
    }

    // Under-cabinet strip along the kitchen's longest wall.
    if (want.has('led-strips') && room.type === 'kitchen') {
      const horizontal = r.w >= r.h;
      const inset = m(0.4);
      const len = (horizontal ? r.w : r.h) * 0.75;
      const start = horizontal
        ? { x: r.x + (r.w - len) / 2, y: r.y + inset }
        : { x: r.x + inset, y: r.y + (r.h - len) / 2 };
      const end = horizontal ? { x: start.x + len, y: start.y } : { x: start.x, y: start.y + len };
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
            showLabel: true,
          },
          'led-strips',
          room.id,
        );
        lit(room, 'led-strips');
      }
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
  /**
   * A wall position beside the latch end of a door, on the given room's side. `extra` moves further
   * along the wall (for panels and controllers next to the switch).
   */
  const besideLatch = (door: Door, side: Room, extra = 0): Pt | null => {
    const along = unit(door.hingeU, door.latchU);
    const normal = { x: -along.y, y: along.x };
    for (const [alongSide, base] of [
      [1, door.latchU],
      [-1, door.hingeU],
    ] as const) {
      const onWall = add(base, along, alongSide * (m(0.25) + extra));
      for (const s of [1, -1]) {
        const p = add(onWall, normal, s * m(0.15));
        if (owner(p)?.id === side.id) return p;
      }
    }
    return null;
  };

  const doorsOf = (room: Room) => doors.filter((d) => d.sides.includes(room.id));
  const other = (d: Door, room: Room) => {
    const id = d.sides.find((s) => s !== room.id) ?? null;
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
    } else if (owner(p)?.id === room.id) addPlate(p, gangsFor(room), room.id);
  };

  // When lights are being planned, rooms that got none need no switch; otherwise switch every room.
  const planningLights = categories.some((c) => categoryById(c).planType === 'lighting');
  for (const room of rooms) {
    if (room.type === 'outdoor' || (planningLights && !circuits.has(room.id))) continue;
    const ds = doorsOf(room);

    if (SWITCHED_FROM_OUTSIDE.includes(room.type)) {
      // Switch on the wall outside the door, in the room you approach from.
      const door = ds[0];
      const side = door && other(door, room);
      if (door && side && side.type !== 'outdoor') placeSwitch(room, door, side, gangsFor(room));
      else openPlanSwitch(room);
      continue;
    }

    if (ds.length && WALKWAYS.includes(room.type)) {
      // Two-way switching where the walkway meets other walkways, living spaces or the entrance.
      const ends = ds.filter((d) => walkable(other(d, room)));
      for (const d of ends.length ? ends : [ds[0]!]) placeSwitch(room, d, room, 1);
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
  const hub =
    rooms.filter((r) => LIVING.includes(r.type)).sort((a, b) => area(b) - area(a))[0] ??
    rooms.filter((r) => r.type !== 'outdoor').sort((a, b) => area(b) - area(a))[0];

  if (want.has('control-panels')) {
    if (entrance && entranceRoom) {
      const at = besideLatch(entrance, entranceRoom, m(0.45));
      if (at) markerAt('control-panels', at, entranceRoom.id);
    } else if (hub) {
      const anchor = switchAnchors.get(hub.id);
      const at = anchor ? besideLatch(anchor.door, anchor.side, m(0.45)) : centre(hub.rect);
      if (at) markerAt('control-panels', at, hub.id);
    }
    const master = rooms.find((r) => r.type === 'master-bedroom');
    const anchor = master && switchAnchors.get(master.id);
    if (master && anchor) {
      const at = besideLatch(anchor.door, anchor.side, m(0.45));
      if (at) markerAt('control-panels', at, master.id);
    }
  }

  if (want.has('aircon-controllers')) {
    for (const room of rooms.filter((r) => AIRCON_ROOMS.includes(r.type))) {
      const anchor = switchAnchors.get(room.id);
      const at = anchor
        ? besideLatch(anchor.door, anchor.side, m(anchor.door.isMainEntrance ? 0.9 : 0.45))
        : null;
      markerAt('aircon-controllers', at ?? centre(room.rect), room.id);
    }
  }

  // --- curtains ----------------------------------------------------------------------------------
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
      const horizontal = Math.abs(along.x) >= Math.abs(along.y);
      markerAt(
        'curtains-blinds',
        at,
        owner(at)!.id,
        { wide: dist(a, b) >= m(2.4) },
        horizontal ? 0 : 90,
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
      const candidates = rooms.filter(
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
    for (const room of rooms.filter((r) => WALKWAYS.includes(r.type) && r.type !== 'staircase')) {
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
