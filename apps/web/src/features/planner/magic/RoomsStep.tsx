import { useRef, useState, type PointerEvent } from 'react';
import {
  Check,
  ChevronDown,
  DoorOpen,
  PanelTop,
  Plus,
  ScanSearch,
  Sparkles,
  SquareDashed,
  Trash2,
  X,
} from 'lucide-react';
import {
  EXTRA_ROOMS,
  FLAT_PRESETS,
  newId,
  partBoxes,
  roomTypeFromName,
  withFoundRooms,
  type Box,
  type DrawnRoom,
  type DrawnWindow,
  type FoundRoom,
  type RoomLayout,
} from '@maxsen/domain';
import { Button, Field, IconButton, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCoarsePointer } from '@/lib/pointer';
import { applyPreset, blank, drawn } from './room-layouts';

interface Props {
  imageUrl: string;
  /** Drawing width / height. */
  aspect: number;
  layout: RoomLayout;
  onChange: (layout: RoomLayout) => void;
  /** Fills the rooms in with Claude, when it is set up. */
  onSuggest?: () => void;
  suggesting?: boolean;
  /** The window on the drawing under an X marked at (x, y), or null when there's no line there. */
  readWindow?: (x: number, y: number) => Promise<DrawnWindow | null>;
  /** Every closed room on the drawing. */
  findRooms?: () => Promise<FoundRoom[]>;
}

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
interface Op {
  kind: 'move' | Edge;
  /** The room's main box, or one of its extra areas (by index). */
  target: 'main' | number;
  from: { x: number; y: number };
  orig: Box;
  moved: boolean;
}
/** The square a tap drops, as a share of the drawing's width; how close a handle must be, in px. */
const DROP = 0.07;
const HANDLE_PX = 10;
const MIN_SIDE = 0.015;
const CURSORS: Record<Op['kind'], string> = {
  move: 'cursor-move',
  n: 'cursor-ns-resize',
  s: 'cursor-ns-resize',
  e: 'cursor-ew-resize',
  w: 'cursor-ew-resize',
  ne: 'cursor-nesw-resize',
  sw: 'cursor-nesw-resize',
  nw: 'cursor-nwse-resize',
  se: 'cursor-nwse-resize',
};

/** A box moved, or resized by an edge or corner, kept on the drawing. */
function reshape(b: Box, kind: Op['kind'], dx: number, dy: number): Box {
  if (kind === 'move') {
    return {
      ...b,
      x: Math.min(1 - b.w, Math.max(0, b.x + dx)),
      y: Math.min(1 - b.h, Math.max(0, b.y + dy)),
    };
  }
  let x0 = b.x;
  let y0 = b.y;
  let x1 = b.x + b.w;
  let y1 = b.y + b.h;
  if (kind.includes('w')) x0 = Math.max(0, Math.min(x0 + dx, x1 - MIN_SIDE));
  if (kind.includes('e')) x1 = Math.min(1, Math.max(x1 + dx, x0 + MIN_SIDE));
  if (kind.includes('n')) y0 = Math.max(0, Math.min(y0 + dy, y1 - MIN_SIDE));
  if (kind.includes('s')) y1 = Math.min(1, Math.max(y1 + dy, y0 + MIN_SIDE));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** "Room n" for a room tapped beyond the list, numbered after the rooms there. */
const nextRoomName = (rooms: DrawnRoom[]) => {
  let n = rooms.length;
  while (rooms.some((r) => r.name === `Room ${n + 1}`)) n++;
  return `Room ${n + 1}`;
};

/** Outlining the room, tapping its door, adding another area to it, or done with it. */
type Mode = 'draw' | 'door' | 'part' | 'done';

/**
 * The pre-step of Magic Plan: say what kind of home it is, then outline each room on the drawing
 * with a box and tap where its door is. Magic Plan then plans exactly those rooms.
 */
export function RoomsStep({
  imageUrl,
  aspect,
  layout,
  onChange,
  onSuggest,
  suggesting,
  readWindow,
  findRooms,
}: Props) {
  const coarse = useCoarsePointer();
  /** Reading the room under a tap, or all rooms; and why a tap found nothing. */
  const [finding, setFinding] = useState(false);
  const [roomNote, setRoomNote] = useState<string | null>(null);
  /** Marking windows instead of outlining rooms. */
  const [windowMode, setWindowMode] = useState(false);
  const [reading, setReading] = useState(false);
  const [windowNote, setWindowNote] = useState<string | null>(null);
  const windows = layout.windows ?? [];
  /** Marking doors, all at once, once the rooms are outlined. */
  const [doorMode, setDoorMode] = useState(false);
  const [doorNote, setDoorNote] = useState<string | null>(null);
  const firstTodo = layout.rooms.find((r) => !drawn(r));
  const [activeId, setActiveId] = useState<string | null>(firstTodo?.id ?? null);
  const [mode, setMode] = useState<Mode>('draw');
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** Moving or resizing the selected room's box, and where it is while dragged. */
  const [op, setOp] = useState<Op | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [hover, setHover] = useState<Op['kind'] | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const active = layout.rooms.find((r) => r.id === activeId) ?? null;

  const update = (id: string, patch: Partial<DrawnRoom>) =>
    onChange({ ...layout, rooms: layout.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const select = (r: DrawnRoom, m: Mode = drawn(r) ? 'done' : 'draw') => {
    setActiveId(r.id);
    setMode(m);
  };
  /** On to the next room still to outline. */
  const advance = (rooms: DrawnRoom[], doneId: string) => {
    const next = rooms.find((r) => r.id !== doneId && !drawn(r));
    setActiveId(next?.id ?? null);
    setMode('draw');
  };
  /** The next room in the list still to outline (what a drag or tap on empty floor outlines). */
  const nextTodo = layout.rooms.find((r) => !drawn(r) && r.id !== activeId) ?? null;

  const at = (e: PointerEvent) => {
    const rect = frame.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };
  /**
   * The selected room's box (or one of its extra areas) under a point: a corner or edge to resize
   * it by, or its inside to move it.
   */
  const grab = (p: { x: number; y: number }): Omit<Op, 'from' | 'moved'> | null => {
    if (windowMode || doorMode || !active || !drawn(active) || mode === 'door' || mode === 'part')
      return null;
    const rect = frame.current!.getBoundingClientRect();
    // A fingertip needs more room than a mouse pointer.
    const reach = coarse ? HANDLE_PX * 1.6 : HANDLE_PX;
    const tx = reach / rect.width;
    const ty = reach / rect.height;
    const boxes: { target: 'main' | number; b: Box }[] = [
      ...(active.parts ?? []).map((b, i) => ({ target: i, b })),
      { target: 'main' as const, b: active },
    ];
    for (const { target, b } of boxes) {
      const nearX = (v: number) => Math.abs(p.x - v) <= tx;
      const nearY = (v: number) => Math.abs(p.y - v) <= ty;
      const withinX = p.x >= b.x - tx && p.x <= b.x + b.w + tx;
      const withinY = p.y >= b.y - ty && p.y <= b.y + b.h + ty;
      if (!withinX || !withinY) continue;
      const v = nearY(b.y) ? 'n' : nearY(b.y + b.h) ? 's' : '';
      const h = nearX(b.x) ? 'w' : nearX(b.x + b.w) ? 'e' : '';
      const edge = (v + h) as Edge | '';
      const orig = { x: b.x, y: b.y, w: b.w, h: b.h };
      if (edge) return { kind: edge, target, orig };
      return { kind: 'move', target, orig };
    }
    return null;
  };
  // A press on the selected room's box moves or resizes it; anywhere else it starts a new box, and
  // on release a tap and a drag mean different things (see `up`).
  const down = (e: PointerEvent) => {
    const p = at(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const hit = grab(p);
    if (hit) {
      setOp({ ...hit, from: p, moved: false });
      return;
    }
    setBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  /** The smallest outlined room (counting its added areas) under a point. */
  const roomAt = (p: { x: number; y: number }) =>
    layout.rooms
      .filter(drawn)
      .filter((r) =>
        [r, ...(r.parts ?? [])].some(
          (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h,
        ),
      )
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
  const move = (e: PointerEvent) => {
    const p = at(e);
    if (op) {
      const next = reshape(op.orig, op.kind, p.x - op.from.x, p.y - op.from.y);
      if (!op.moved && Math.hypot(p.x - op.from.x, p.y - op.from.y) < 0.004) return;
      setOp({ ...op, moved: true });
      setDraft(next);
      return;
    }
    if (!box) {
      setHover(grab(p)?.kind ?? null);
      return;
    }
    setBox({ ...box, x1: p.x, y1: p.y });
  };
  const up = () => {
    if (op) {
      if (op.moved && draft && active) {
        if (op.target === 'main') update(active.id, draft);
        else
          update(active.id, {
            parts: (active.parts ?? []).map((b, i) => (i === op.target ? draft : b)),
          });
      }
      setOp(null);
      setDraft(null);
      return;
    }
    if (box && windowMode) {
      const dx = Math.abs(box.x1 - box.x0);
      const dy = Math.abs(box.y1 - box.y0) / aspect;
      setBox(null);
      if (Math.max(dx, dy) < 0.02) {
        void mark(box.x0, box.y0);
        return;
      }
      // Dragged along a wall: that's the window, straight along the longer direction.
      const win =
        dx >= dy
          ? { x1: Math.min(box.x0, box.x1), y1: box.y0, x2: Math.max(box.x0, box.x1), y2: box.y0 }
          : { x1: box.x0, y1: Math.min(box.y0, box.y1), x2: box.x0, y2: Math.max(box.y0, box.y1) };
      onChange({ ...layout, windows: [...windows, { id: newId('room'), ...win, marked: true }] });
      setWindowNote(null);
      return;
    }
    if (box && doorMode) {
      setBox(null);
      const dx = Math.abs(box.x1 - box.x0);
      const dy = Math.abs(box.y1 - box.y0);
      if (Math.max(dx, dy) < 0.02) markDoor({ x: box.x0, y: box.y0 });
      return;
    }
    if (!box) return;
    const x = Math.min(box.x0, box.x1);
    const y = Math.min(box.y0, box.y1);
    const w = Math.abs(box.x1 - box.x0);
    const h = Math.abs(box.y1 - box.y0);
    setBox(null);
    if (w < 0.02 || h < 0.02) {
      // A tap: the door, while one is being marked; otherwise pick the room tapped.
      const p = { x: box.x0, y: box.y0 };
      if (active && mode === 'door') {
        update(active.id, { door: p });
        setMode('done');
        return;
      }
      const hit = roomAt(p);
      // (Redrawing a room: a tap inside its old outline outlines it afresh.)
      const redraw = mode === 'draw' && hit?.id === active?.id;
      if (hit && mode !== 'part' && !redraw) {
        select(hit, 'done');
        return;
      }
      dropBox(p);
      return;
    }
    if (active && mode === 'part') {
      // Another area joined on to the room (an L-shaped living room, say).
      update(active.id, { parts: [...(active.parts ?? []), { x, y, w, h }] });
      setMode('done');
      return;
    }
    // A drag outlines the room being drawn, or else the next room still to outline (or a new
    // room), so rooms are boxed one after another; doors are marked afterwards, all at once.
    let rooms = layout.rooms;
    let target = active && mode === 'draw' ? active : (layout.rooms.find((r) => !drawn(r)) ?? null);
    if (!target) {
      target = blank('other', nextRoomName(layout.rooms));
      rooms = [...rooms, target];
    }
    const id = target.id;
    onChange({
      ...layout,
      rooms: rooms.map((r) => (r.id === id ? { ...r, x, y, w, h, door: null, parts: [] } : r)),
    });
    setActiveId(id);
    setMode('done');
  };

  /**
   * A door tapped on the drawing: it goes to the room whose wall it's on (a room still without a
   * door first, then the room it opens into rather than a living area or corridor, then the
   * smaller). Tapping a door again removes it.
   */
  const markDoor = (p: { x: number; y: number }) => {
    const dist = (q: { x: number; y: number }) => Math.hypot(p.x - q.x, (p.y - q.y) / aspect);
    const hit = layout.rooms.find((r) => r.door && dist(r.door) < 0.018);
    if (hit) {
      update(hit.id, { door: null });
      setDoorNote(`Door taken off the ${hit.name}.`);
      return;
    }
    const gap = (r: DrawnRoom) =>
      Math.min(
        ...[r, ...(r.parts ?? [])].map((b) => {
          const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w));
          const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h)) / aspect;
          return Math.hypot(dx, dy);
        }),
      );
    const open = ['living', 'living-dining', 'dining', 'family', 'corridor', 'foyer', 'other'];
    const near = layout.rooms.filter((r) => drawn(r) && gap(r) < 0.03);
    const owner = near.sort(
      (a, b) =>
        Number(!!a.door) - Number(!!b.door) ||
        Number(open.includes(a.type)) - Number(open.includes(b.type)) ||
        a.w * a.h - b.w * b.h,
    )[0];
    if (!owner) {
      setDoorNote('That’s not by any room. Tap on a room’s wall, where its door is.');
      return;
    }
    update(owner.id, { door: p });
    setDoorNote(`Door for the ${owner.name}. Tap it again to take it off.`);
  };

  /**
   * A tap on the drawing drops a small square there for the room being drawn (else the next room
   * still to outline, else a new room), selected so it can be dragged and its corners pulled to fit.
   * While adding an area, the square is that extra area.
   */
  const dropBox = (p: { x: number; y: number }) => {
    const w = DROP;
    const h = DROP * aspect;
    const x = Math.min(1 - w, Math.max(0, p.x - w / 2));
    const y = Math.min(1 - h, Math.max(0, p.y - h / 2));
    if (active && mode === 'part') {
      update(active.id, { parts: [...(active.parts ?? []), { x, y, w, h }] });
      setMode('done');
      return;
    }
    let rooms = layout.rooms;
    let target = active && mode === 'draw' ? active : (layout.rooms.find((r) => !drawn(r)) ?? null);
    if (!target) {
      target = blank('other', nextRoomName(layout.rooms));
      rooms = [...rooms, target];
    }
    const id = target.id;
    onChange({
      ...layout,
      rooms: rooms.map((r) => (r.id === id ? { ...r, x, y, w, h, door: null, parts: [] } : r)),
    });
    setActiveId(id);
    setMode('done');
  };

  /** Outlines every room on the drawing at once; listed rooms not outlined yet are dropped. */
  const findAll = async () => {
    if (!findRooms) return;
    setFinding(true);
    setRoomNote(null);
    try {
      const found = await findRooms();
      if (!found.length) {
        setRoomNote('No closed rooms found on this drawing. Outline them with boxes instead.');
        return;
      }
      const next = withFoundRooms(layout, found);
      onChange(next);
      setActiveId(null);
      setMode('draw');
    } catch {
      setRoomNote('The drawing couldn’t be read. Outline the rooms with boxes instead.');
    } finally {
      setFinding(false);
    }
  };

  /** Gives a room another name (and the type that goes with it). */
  const rename = (room: DrawnRoom, name: string, type: DrawnRoom['type']) => {
    // A listed room of that name not outlined yet takes this room's outline.
    const listed = layout.rooms.find((r) => r.name === name && r.id !== room.id && !drawn(r));
    if (listed) {
      // The room renamed goes back to "not outlined" if the home's list has it, else it goes.
      const preset = FLAT_PRESETS.find((p) => p.id === layout.presetId);
      const keep = preset?.rooms.some((p) => p.name === room.name);
      const rooms = layout.rooms
        .filter((r) => keep || r.id !== room.id)
        .map((r) =>
          r.id === listed.id
            ? {
                ...r,
                x: room.x,
                y: room.y,
                w: room.w,
                h: room.h,
                parts: room.parts,
                door: room.door,
              }
            : r.id === room.id
              ? { ...r, x: 0, y: 0, w: 0, h: 0, parts: [], door: null }
              : r,
        );
      onChange({ ...layout, rooms });
      setActiveId(listed.id);
      return;
    }
    update(room.id, { name, type });
  };
  /** Names to choose from: the home type's rooms not outlined yet, then any kind of room. */
  const namesFor = (room: DrawnRoom) => {
    const preset = FLAT_PRESETS.find((p) => p.id === layout.presetId);
    const taken = new Set(
      layout.rooms.filter((r) => drawn(r) && r.id !== room.id).map((r) => r.name),
    );
    const listed = [
      ...(preset?.rooms ?? []),
      ...layout.rooms.filter((r) => !drawn(r)).map((r) => ({ type: r.type, name: r.name })),
    ].filter((r, i, all) => !taken.has(r.name) && all.findIndex((x) => x.name === r.name) === i);
    const extras = EXTRA_ROOMS.filter((e) => !listed.some((l) => l.name === e.name)).map((e) => {
      const same = layout.rooms.filter((r) => r.id !== room.id && r.name.startsWith(e.name)).length;
      return { type: e.type, name: same ? `${e.name} ${same + 1}` : e.name };
    });
    return { listed, extras };
  };

  /** An X tapped on the drawing: removes the window it's on, or marks the window on that line. */
  const mark = async (x: number, y: number) => {
    const hit = windows.find((w) => {
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;
      return Math.hypot(x - mx, (y - my) / aspect) < 0.02;
    });
    if (hit) {
      onChange({ ...layout, windows: windows.filter((w) => w.id !== hit.id) });
      setWindowNote(null);
      return;
    }
    if (!readWindow) return;
    setReading(true);
    try {
      const win = await readWindow(x, y);
      if (win) {
        onChange({ ...layout, windows: [...windows, win] });
        setWindowNote(null);
      } else {
        setWindowNote('No window line there. Tap right on the line, or drag along the window.');
      }
    } catch {
      setWindowNote('The drawing couldn’t be read here. Drag along the window instead.');
    } finally {
      setReading(false);
    }
  };

  const done = layout.rooms.filter((r) => drawn(r)).length;
  const nextName = nextTodo ? `the ${nextTodo.name}` : 'another room';
  const prompt = windowMode
    ? reading
      ? 'Finding the window…'
      : 'Put an X on each window: tap its line. Tap an X again to remove it.'
    : doorMode
      ? 'Tap each door on the drawing, on the wall where it opens. Tap a green dot to take it off.'
      : finding
        ? 'Finding the rooms…'
        : !active
          ? done === layout.rooms.length && done > 0
            ? 'All rooms are outlined. Now press Mark doors and tap each door.'
            : 'Tap each room to drop a box, then drag it and its corners to fit (or drag a box out), in the order listed.'
          : mode === 'draw'
            ? `Tap the ${active.name} to drop a box there (or drag one out).`
            : mode === 'part'
              ? `Tap or drag a box over the rest of the ${active.name}. It joins on to the room.`
              : mode === 'done'
                ? `Drag the ${active.name}’s box or its corners to fit. Then tap ${nextName}. Odd shape? Press +.`
                : `Tap where the ${active.name}’s door is.`;
  /** Adds another area to the active room. */
  const addPart = () => {
    if (!active) return;
    setMode('part');
  };
  const pct = (n: number) => `${n * 100}%`;
  const live = box && {
    x: Math.min(box.x0, box.x1),
    y: Math.min(box.y0, box.y1),
    w: Math.abs(box.x1 - box.x0),
    h: Math.abs(box.y1 - box.y0),
  };

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-5 max-[820px]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-3">
        <Field label="Type of home">
          <Select
            value={layout.presetId}
            options={FLAT_PRESETS.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(id) => {
              const next = applyPreset(layout, id);
              onChange(next);
              const first = next.rooms.find((r) => !drawn(r));
              setActiveId(first?.id ?? null);
              setMode('draw');
            }}
          />
        </Field>
        <Field label="Floor area (m²)" hint="Sets the drawing’s scale, for spacing lights.">
          <Input
            type="number"
            min={10}
            max={2000}
            value={String(layout.floorAreaM2)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > 0) onChange({ ...layout, floorAreaM2: v });
            }}
          />
        </Field>
        <div className="flex items-center justify-between border-b border-rule pb-1.5">
          <span className="text-control font-semibold text-ink">
            Rooms ({done} of {layout.rooms.length} outlined)
          </span>
        </div>
        <ul
          aria-label="Rooms to outline"
          className="flex max-h-[300px] flex-col gap-1 overflow-y-auto"
        >
          {layout.rooms.map((r) => {
            const status = !drawn(r) ? 'Not outlined' : r.door ? 'Done' : 'Door not marked';
            return (
              <li
                key={r.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-chip px-1 py-0.5',
                  r.id === activeId && 'bg-brass-tint',
                )}
              >
                <button
                  type="button"
                  aria-label={`${r.name}: ${status}`}
                  aria-pressed={r.id === activeId}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-control text-ink"
                  onClick={() => select(r, drawn(r) ? 'done' : 'draw')}
                >
                  {!drawn(r) ? (
                    <SquareDashed aria-hidden className="size-4 shrink-0 text-ink-3" />
                  ) : r.door ? (
                    <Check aria-hidden className="size-4 shrink-0 text-ok" />
                  ) : (
                    <DoorOpen aria-hidden className="size-4 shrink-0 text-warn" />
                  )}
                  <span className="truncate">{r.name}</span>
                  {(r.parts?.length ?? 0) > 0 && (
                    <span className="shrink-0 text-meta text-ink-3">
                      {(r.parts?.length ?? 0) + 1} areas
                    </span>
                  )}
                </button>
                {drawn(r) && (
                  <IconButton
                    size="sm"
                    label={`Mark the ${r.name}’s door`}
                    icon={<DoorOpen className="size-4" />}
                    onClick={() => select(r, 'door')}
                  />
                )}
                <IconButton
                  size="sm"
                  label={`Remove ${r.name}`}
                  icon={<Trash2 className="size-4" />}
                  onClick={() => {
                    onChange({ ...layout, rooms: layout.rooms.filter((x) => x.id !== r.id) });
                    if (r.id === activeId) setActiveId(null);
                  }}
                />
              </li>
            );
          })}
        </ul>
        <Select
          compact
          aria-label="Add a room"
          value=""
          placeholder="+ Add a room…"
          options={EXTRA_ROOMS.map((r, i) => ({ value: String(i), label: r.name }))}
          onChange={(v) => {
            const extra = EXTRA_ROOMS[Number(v)];
            if (!extra) return;
            const same = layout.rooms.filter((r) => r.name.startsWith(extra.name)).length;
            const room = blank(extra.type, same ? `${extra.name} ${same + 1}` : extra.name);
            onChange({ ...layout, rooms: [...layout.rooms, room] });
            select(room, 'draw');
          }}
        />
        <div className="flex items-center justify-between border-b border-rule pt-1 pb-1.5">
          <span className="text-control font-semibold text-ink">
            Doors ({layout.rooms.filter((r) => drawn(r) && r.door).length} of {done})
          </span>
        </div>
        <p className="text-meta text-ink-2">
          Once the rooms are outlined, mark all the doors in one go: tap each on the wall where it
          opens. The switch goes beside it. Rooms found by tapping already have theirs.
        </p>
        <Button
          size="sm"
          aria-pressed={doorMode}
          icon={<DoorOpen className="size-4" />}
          disabled={done === 0}
          onClick={() => {
            setDoorMode((v) => !v);
            setWindowMode(false);
            setBox(null);
            setDoorNote(null);
          }}
        >
          {doorMode ? 'Done marking doors' : 'Mark doors'}
        </Button>
        <div className="flex items-center justify-between border-b border-rule pt-1 pb-1.5">
          <span className="text-control font-semibold text-ink">Windows ({windows.length})</span>
          {windows.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...layout, windows: [] })}>
              Clear all
            </Button>
          )}
        </div>
        <p className="text-meta text-ink-2">
          Mark each window with an X on its line (on the home’s outer walls, and the glass doors
          onto a balcony). The window is followed along its line to its ends. Smart curtains go only
          at these, in living rooms, bedrooms and the study, with a curtain-cove LED strip above.
        </p>
        {windows.length === 0 && (
          <p className="text-meta text-ink-2">
            No windows marked yet, so no curtains will be planned.
          </p>
        )}
        {windows.length > 0 && (
          <ul aria-label="Windows" className="flex max-h-[140px] flex-col gap-0.5 overflow-y-auto">
            {windows.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 px-1 text-control text-ink">
                <PanelTop aria-hidden className="size-4 shrink-0 text-[#2F6FB3]" />
                <span className="flex-1">Window {i + 1}</span>
                <IconButton
                  size="sm"
                  label={`Remove window ${i + 1}`}
                  icon={<Trash2 className="size-4" />}
                  onClick={() =>
                    onChange({ ...layout, windows: windows.filter((x) => x.id !== w.id) })
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          aria-pressed={windowMode}
          icon={<X className="size-4" />}
          onClick={() => {
            setWindowMode((v) => !v);
            setDoorMode(false);
            setBox(null);
            setWindowNote(null);
          }}
        >
          {windowMode ? 'Done marking windows' : 'Mark windows'}
        </Button>
        {findRooms && (
          <div className="flex flex-col gap-1 border-t border-rule pt-3">
            <Button
              size="sm"
              icon={<ScanSearch className="size-4" />}
              loading={finding}
              onClick={() => void findAll()}
            >
              Find all rooms
            </Button>
            <p className="text-meta text-ink-2">
              Quickest: outlines every room on the drawing, with its door, and plans each by its
              size and shape. Name the bedrooms and living room (tap a room’s name on the drawing)
              for the most exact plan.
            </p>
          </div>
        )}
        {onSuggest && (
          <Button
            size="sm"
            icon={<Sparkles className="size-4" />}
            loading={suggesting}
            onClick={onSuggest}
          >
            Suggest rooms with Claude
          </Button>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <div className="flex flex-col">
            <p role="status" className="text-control text-ink">
              {prompt}
            </p>
            {windowMode && windowNote && (
              <p role="alert" className="text-meta text-warn">
                {windowNote}
              </p>
            )}
            {doorMode && doorNote && (
              <p role="status" className="text-meta text-ink-2">
                {doorNote}
              </p>
            )}
            {!windowMode && !doorMode && roomNote && (
              <p role="alert" className="text-meta text-warn">
                {roomNote}
              </p>
            )}
          </div>
          {!windowMode && !doorMode && active && mode === 'door' && (
            <Button size="sm" onClick={() => setMode('done')}>
              Cancel
            </Button>
          )}
          {!windowMode && !doorMode && active && mode === 'part' && (
            <Button size="sm" onClick={() => setMode('done')}>
              Cancel
            </Button>
          )}
          {!windowMode && !doorMode && active && mode === 'done' && (
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMode('draw')}>
                Redraw
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('door')}>
                Move door
              </Button>
              <Button size="sm" onClick={() => advance(layout.rooms, active.id)}>
                Next room
              </Button>
            </span>
          )}
        </div>
        <div className="flex items-center justify-center bg-desk p-3">
          <div
            ref={frame}
            data-testid="room-canvas"
            className={cn(
              'relative w-full touch-none select-none border border-rule-2 bg-surface',
              op ? CURSORS[op.kind] : hover ? CURSORS[hover] : 'cursor-crosshair',
            )}
            style={{
              aspectRatio: String(aspect),
              maxHeight: '58vh',
              maxWidth: `calc(58vh * ${aspect})`,
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => {
              setBox(null);
              setOp(null);
              setDraft(null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <img
              src={imageUrl}
              alt="The drawing"
              className="absolute inset-0 size-full"
              draggable={false}
            />
            <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
              {layout.rooms.filter(drawn).map((shown) => {
                const on = shown.id === activeId;
                // The box being dragged shows where it's going.
                const r =
                  on && op && draft
                    ? op.target === 'main'
                      ? { ...shown, ...draft }
                      : {
                          ...shown,
                          parts: (shown.parts ?? []).map((b, i) => (i === op.target ? draft : b)),
                        }
                    : shown;
                return (
                  <g key={r.id}>
                    <rect
                      data-testid="room-box"
                      data-room={r.name}
                      data-box={[r.x, r.y, r.w, r.h].map((v) => v.toFixed(3)).join(',')}
                      x={pct(r.x)}
                      y={pct(r.y)}
                      width={pct(r.w)}
                      height={pct(r.h)}
                      fill={on ? 'rgba(168,135,58,0.28)' : 'rgba(168,135,58,0.12)'}
                      stroke="#876B29"
                      strokeWidth={on ? 3 : 1.5}
                    />
                    {partBoxes(r).map((p, j) => (
                      <rect
                        key={j}
                        data-testid="room-part"
                        x={pct(p.x)}
                        y={pct(p.y)}
                        width={pct(p.w)}
                        height={pct(p.h)}
                        fill={on ? 'rgba(168,135,58,0.28)' : 'rgba(168,135,58,0.12)'}
                        stroke="#876B29"
                        strokeWidth={on ? 2 : 1}
                        strokeDasharray="5 4"
                      />
                    ))}
                    <text
                      x={pct(r.x + r.w / 2)}
                      y={pct(r.y + r.h / 2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill="#4A3B16"
                    >
                      {r.name}
                    </text>
                    {r.door && (
                      <circle
                        cx={pct(r.door.x)}
                        cy={pct(r.door.y)}
                        r={6}
                        fill="#3E7A4F"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    )}
                    {/* Corner and edge handles to pull the selected room's box to fit. */}
                    {on &&
                      !windowMode &&
                      !doorMode &&
                      mode !== 'door' &&
                      mode !== 'part' &&
                      [r, ...(r.parts ?? [])].map((b, j) =>
                        (
                          [
                            [0, 0],
                            [0.5, 0],
                            [1, 0],
                            [0, 0.5],
                            [1, 0.5],
                            [0, 1],
                            [0.5, 1],
                            [1, 1],
                          ] as const
                        ).map(([fx, fy]) => (
                          <svg
                            key={`${j}-${fx}-${fy}`}
                            data-testid="room-handle"
                            x={pct(b.x + b.w * fx)}
                            y={pct(b.y + b.h * fy)}
                            overflow="visible"
                          >
                            <rect
                              x={coarse ? -8 : -4.5}
                              y={coarse ? -8 : -4.5}
                              width={coarse ? 16 : 9}
                              height={coarse ? 16 : 9}
                              rx={1.5}
                              fill="#FFFFFF"
                              stroke="#876B29"
                              strokeWidth={1.5}
                            />
                          </svg>
                        )),
                      )}
                  </g>
                );
              })}
              {windows.map((w) => (
                <g key={w.id} data-testid="window-mark">
                  <line
                    x1={pct(w.x1)}
                    y1={pct(w.y1)}
                    x2={pct(w.x2)}
                    y2={pct(w.y2)}
                    stroke="#2F6FB3"
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  <svg x={pct((w.x1 + w.x2) / 2)} y={pct((w.y1 + w.y2) / 2)} overflow="visible">
                    <path
                      d="M-7 -7 L7 7 M-7 7 L7 -7"
                      stroke="#FFFFFF"
                      strokeWidth={6}
                      strokeLinecap="round"
                    />
                    <path
                      d="M-7 -7 L7 7 M-7 7 L7 -7"
                      stroke="#B3412F"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  </svg>
                </g>
              ))}
              {live && windowMode && (
                <line
                  x1={pct(box.x0)}
                  y1={pct(box.y0)}
                  x2={pct(
                    Math.abs(box.x1 - box.x0) >= Math.abs(box.y1 - box.y0) / aspect
                      ? box.x1
                      : box.x0,
                  )}
                  y2={pct(
                    Math.abs(box.x1 - box.x0) >= Math.abs(box.y1 - box.y0) / aspect
                      ? box.y0
                      : box.y1,
                  )}
                  stroke="#2F6FB3"
                  strokeWidth={4}
                  strokeDasharray="6 4"
                />
              )}
              {live && !windowMode && (
                <rect
                  x={pct(live.x)}
                  y={pct(live.y)}
                  width={pct(live.w)}
                  height={pct(live.h)}
                  fill="rgba(168,135,58,0.2)"
                  stroke="#A8873A"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}
            </svg>
            {!windowMode && !doorMode && active && drawn(active) && (
              <div
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: pct(active.x + active.w / 2), top: pct(active.y + active.h / 2) }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {(() => {
                  const { listed, extras } = namesFor(active);
                  const all = [...listed, ...extras];
                  return (
                    <label className="relative flex items-center gap-1 rounded-full border-2 border-white bg-ink px-2.5 py-1 text-meta font-semibold text-surface shadow-md hover:bg-ink-2">
                      {active.name}
                      <ChevronDown aria-hidden className="size-3.5" />
                      {/* A native list over the label: works the same with a mouse, touch and keys. */}
                      <select
                        aria-label={`Rename the ${active.name}`}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        value=""
                        onChange={(e) => {
                          const pick = all.find((r) => r.name === e.target.value);
                          if (pick)
                            rename(active, pick.name, roomTypeFromName(pick.name) ?? pick.type);
                        }}
                      >
                        <option value="" disabled>
                          Rename the {active.name}…
                        </option>
                        {listed.length > 0 && (
                          <optgroup label="Rooms of this home">
                            {listed.map((r) => (
                              <option key={r.name} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Other rooms">
                          {extras.map((r) => (
                            <option key={r.name} value={r.name}>
                              {r.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                  );
                })()}
              </div>
            )}
            {!windowMode &&
              !doorMode &&
              active &&
              drawn(active) &&
              mode !== 'part' &&
              mode !== 'draw' && (
                <>
                  <button
                    type="button"
                    aria-label={`Add another area to the ${active.name}`}
                    title="Add another area to this room"
                    className="absolute z-10 flex size-7 translate-x-1.5 -translate-y-[calc(100%+6px)] items-center justify-center rounded-full border-2 border-white bg-brass text-white shadow-md hover:bg-brass-2 focus-visible:outline-2"
                    style={{ left: pct(active.x + active.w), top: pct(active.y) }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={addPart}
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                  {(active.parts ?? []).map((p, k) => (
                    <button
                      key={k}
                      type="button"
                      aria-label={`Remove area ${k + 2} of the ${active.name}`}
                      title="Remove this area"
                      className="absolute z-10 flex size-6 translate-x-1.5 -translate-y-[calc(100%+6px)] items-center justify-center rounded-full border-2 border-white bg-ink-2 text-white shadow-md hover:bg-danger focus-visible:outline-2"
                      style={{ left: pct(p.x + p.w), top: pct(p.y) }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        update(active.id, {
                          parts: (active.parts ?? []).filter((_, n) => n !== k),
                        })
                      }
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  ))}
                </>
              )}
          </div>
        </div>
        <p className="text-meta text-ink-2">
          Tap a room to drop a box, then drag it and its corners to fit; or drag a box out (it can
          be rough). The green dot is the door; the switch goes beside it. Each X marks a window;
          its blue line shows how far it runs.
        </p>
      </div>
    </div>
  );
}
