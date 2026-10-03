import { useRef, useState, type PointerEvent } from 'react';
import { Check, DoorOpen, PanelTop, Plus, Sparkles, SquareDashed, Trash2, X } from 'lucide-react';
import {
  EXTRA_ROOMS,
  FLAT_PRESETS,
  newId,
  partBoxes,
  type DrawnRoom,
  type DrawnWindow,
  type RoomLayout,
} from '@maxsen/domain';
import { Button, Field, IconButton, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
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
}

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
}: Props) {
  /** Marking windows instead of outlining rooms. */
  const [windowMode, setWindowMode] = useState(false);
  const [reading, setReading] = useState(false);
  const [windowNote, setWindowNote] = useState<string | null>(null);
  const windows = layout.windows ?? [];
  const firstTodo = layout.rooms.find((r) => !drawn(r) || !r.door);
  const [activeId, setActiveId] = useState<string | null>(firstTodo?.id ?? null);
  const [mode, setMode] = useState<Mode>(firstTodo && drawn(firstTodo) ? 'door' : 'draw');
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const active = layout.rooms.find((r) => r.id === activeId) ?? null;

  const update = (id: string, patch: Partial<DrawnRoom>) =>
    onChange({ ...layout, rooms: layout.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const select = (r: DrawnRoom, m: Mode = drawn(r) ? 'door' : 'draw') => {
    setActiveId(r.id);
    setMode(m);
  };
  /** After a room is done, move on to the next room still to draw. */
  const advance = (rooms: DrawnRoom[], doneId: string) => {
    const next = rooms.find((r) => r.id !== doneId && (!drawn(r) || !r.door));
    setActiveId(next?.id ?? null);
    setMode(next && drawn(next) ? 'door' : 'draw');
  };

  const at = (e: PointerEvent) => {
    const rect = frame.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };
  // Every press starts a box; on release, a tap and a drag mean different things (see `up`).
  const down = (e: PointerEvent) => {
    const p = at(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
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
    if (!box) return;
    const p = at(e);
    setBox({ ...box, x1: p.x, y1: p.y });
  };
  const up = () => {
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
        const rooms = layout.rooms.map((r) => (r.id === active.id ? { ...r, door: p } : r));
        onChange({ ...layout, rooms });
        advance(rooms, active.id);
        return;
      }
      const hit = roomAt(p);
      if (hit && mode !== 'part') select(hit, 'done');
      return;
    }
    if (active && mode === 'part') {
      // Another area joined on to the room (an L-shaped living room, say).
      update(active.id, { parts: [...(active.parts ?? []), { x, y, w, h }] });
      setMode(active.door ? 'done' : 'door');
      return;
    }
    // A drag outlines the room being drawn, or else the next room still to outline, so rooms can
    // be boxed one after another without picking each from the list.
    const target =
      active && mode === 'draw' ? active : (layout.rooms.find((r) => !drawn(r)) ?? null);
    if (!target) return;
    update(target.id, { x, y, w, h, door: null, parts: [] });
    setActiveId(target.id);
    setMode('door');
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
  const prompt = windowMode
    ? reading
      ? 'Finding the window…'
      : 'Put an X on each window: tap its line. Tap an X again to remove it.'
    : !active
      ? done === layout.rooms.length && done > 0
        ? 'All rooms are outlined. Tap a room to change it.'
        : 'Drag a box over each room, in the order listed. Tap a box to select it.'
      : mode === 'draw'
        ? `Drag a box over the ${active.name}.`
        : mode === 'part'
          ? `Drag a box over the rest of the ${active.name}. It joins on to the room.`
          : mode === 'done'
            ? `The ${active.name} is outlined. Odd shape? Press + to add another area.`
            : `Tap where the ${active.name}’s door is (or skip if it has none). Odd shape? Press + first.`;
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
              const first = next.rooms.find((r) => !drawn(r) || !r.door);
              setActiveId(first?.id ?? null);
              setMode(first && drawn(first) ? 'door' : 'draw');
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
            setBox(null);
            setWindowNote(null);
          }}
        >
          {windowMode ? 'Done marking windows' : 'Mark windows'}
        </Button>
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
          </div>
          {!windowMode && active && mode === 'door' && (
            <Button size="sm" onClick={() => advance(layout.rooms, active.id)}>
              Skip
            </Button>
          )}
          {!windowMode && active && mode === 'part' && (
            <Button size="sm" onClick={() => setMode(active.door ? 'done' : 'door')}>
              Cancel
            </Button>
          )}
          {!windowMode && active && mode === 'done' && (
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
              'cursor-crosshair',
            )}
            style={{
              aspectRatio: String(aspect),
              maxHeight: '58vh',
              maxWidth: `calc(58vh * ${aspect})`,
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setBox(null)}
          >
            <img
              src={imageUrl}
              alt="The drawing"
              className="absolute inset-0 size-full"
              draggable={false}
            />
            <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
              {layout.rooms.filter(drawn).map((r) => {
                const on = r.id === activeId;
                return (
                  <g key={r.id}>
                    <rect
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
            {!windowMode && active && drawn(active) && mode !== 'part' && mode !== 'draw' && (
              <>
                <button
                  type="button"
                  aria-label={`Add another area to the ${active.name}`}
                  title="Add another area to this room"
                  className="absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brass text-white shadow-md hover:bg-brass-2 focus-visible:outline-2"
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
                    className="absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-ink-2 text-white shadow-md hover:bg-danger focus-visible:outline-2"
                    style={{ left: pct(p.x + p.w), top: pct(p.y + p.h) }}
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
          Boxes can be rough: cover each room’s floor. The green dot is the door; the switch goes
          beside it. Each X marks a window; its blue line shows how far it runs.
        </p>
      </div>
    </div>
  );
}
