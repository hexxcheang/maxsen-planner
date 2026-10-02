import { useRef, useState, type PointerEvent } from 'react';
import { Check, DoorOpen, PanelTop, RefreshCw, Sparkles, SquareDashed, Trash2 } from 'lucide-react';
import { EXTRA_ROOMS, FLAT_PRESETS, newId, type DrawnRoom, type RoomLayout } from '@maxsen/domain';
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
  /** Looks for windows on the drawing again. */
  onFindWindows?: () => void;
  findingWindows?: boolean;
}

type Mode = 'draw' | 'door';

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
  onFindWindows,
  findingWindows,
}: Props) {
  /** Drawing a window along a wall instead of outlining rooms. */
  const [windowMode, setWindowMode] = useState(false);
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
  const down = (e: PointerEvent) => {
    if (!active && !windowMode) return;
    const p = at(e);
    if (!windowMode && active && mode === 'door') {
      const rooms = layout.rooms.map((r) => (r.id === active.id ? { ...r, door: p } : r));
      onChange({ ...layout, rooms });
      advance(rooms, active.id);
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const move = (e: PointerEvent) => {
    if (!box) return;
    const p = at(e);
    setBox({ ...box, x1: p.x, y1: p.y });
  };
  const up = () => {
    if (box && windowMode) {
      // A window runs along one wall: keep the longer direction, straight.
      const dx = Math.abs(box.x1 - box.x0);
      const dy = Math.abs(box.y1 - box.y0) / aspect;
      setBox(null);
      if (Math.max(dx, dy) < 0.02) return;
      const win =
        dx >= dy
          ? { x1: Math.min(box.x0, box.x1), y1: box.y0, x2: Math.max(box.x0, box.x1), y2: box.y0 }
          : { x1: box.x0, y1: Math.min(box.y0, box.y1), x2: box.x0, y2: Math.max(box.y0, box.y1) };
      onChange({ ...layout, windows: [...windows, { id: newId('room'), ...win }] });
      return;
    }
    if (!box || !active) return;
    const x = Math.min(box.x0, box.x1);
    const y = Math.min(box.y0, box.y1);
    const w = Math.abs(box.x1 - box.x0);
    const h = Math.abs(box.y1 - box.y0);
    setBox(null);
    if (w < 0.02 || h < 0.02) return; // a stray tap, not a room
    update(active.id, { x, y, w, h, door: null });
    setMode('door');
  };

  const done = layout.rooms.filter((r) => drawn(r)).length;
  const prompt = windowMode
    ? 'Drag along a wall from one end of the window to the other.'
    : !active
      ? done === layout.rooms.length && done > 0
        ? 'All rooms are outlined. Select a room to redraw it or move its door.'
        : 'Choose the type of home, or add rooms, then outline them on the drawing.'
      : mode === 'draw'
        ? `Drag a box over the ${active.name}.`
        : `Tap where the ${active.name}’s door is (or skip if it has none).`;
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
                  onClick={() => select(r, 'draw')}
                >
                  {!drawn(r) ? (
                    <SquareDashed aria-hidden className="size-4 shrink-0 text-ink-3" />
                  ) : r.door ? (
                    <Check aria-hidden className="size-4 shrink-0 text-ok" />
                  ) : (
                    <DoorOpen aria-hidden className="size-4 shrink-0 text-warn" />
                  )}
                  <span className="truncate">{r.name}</span>
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
          {onFindWindows && (
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw className="size-3.5" />}
              loading={findingWindows}
              onClick={onFindWindows}
            >
              Find again
            </Button>
          )}
        </div>
        <p className="text-meta text-ink-2">
          Found on the home’s outer walls: the glazing between the façade columns and the doors onto
          a balcony. Smart curtains go only at these, in living rooms, bedrooms and the study, with
          a curtain-cove LED strip above. A window between two outlined rooms is ignored.
        </p>
        {windows.length === 0 && !findingWindows && (
          <p className="text-meta text-ink-2">
            No windows yet, so no curtains will be planned. Add them with “Add a window”.
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
          icon={<PanelTop className="size-4" />}
          onClick={() => {
            setWindowMode((v) => !v);
            setBox(null);
          }}
        >
          {windowMode ? 'Done adding windows' : 'Add a window'}
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
          <p role="status" className="text-control text-ink">
            {prompt}
          </p>
          {!windowMode && active && mode === 'door' && (
            <Button size="sm" onClick={() => advance(layout.rooms, active.id)}>
              Skip
            </Button>
          )}
        </div>
        <div className="flex items-center justify-center bg-desk p-3">
          <div
            ref={frame}
            data-testid="room-canvas"
            className={cn(
              'relative w-full touch-none select-none border border-rule-2 bg-surface',
              active || windowMode ? 'cursor-crosshair' : 'cursor-default',
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
                <line
                  key={w.id}
                  x1={pct(w.x1)}
                  y1={pct(w.y1)}
                  x2={pct(w.x2)}
                  y2={pct(w.y2)}
                  stroke="#2F6FB3"
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.85}
                />
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
          </div>
        </div>
        <p className="text-meta text-ink-2">
          Boxes can be rough: cover each room’s floor. The green dot is the door; the switch goes
          beside it. Blue lines are windows.
        </p>
      </div>
    </div>
  );
}
