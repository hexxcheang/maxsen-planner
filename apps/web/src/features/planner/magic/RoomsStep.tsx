import { useRef, useState, type PointerEvent } from 'react';
import { Check, DoorOpen, Sparkles, SquareDashed, Trash2 } from 'lucide-react';
import { EXTRA_ROOMS, FLAT_PRESETS, type DrawnRoom, type RoomLayout } from '@maxsen/domain';
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
}

type Mode = 'draw' | 'door';

/**
 * The pre-step of Magic Plan: say what kind of home it is, then outline each room on the drawing
 * with a box and tap where its door is. Magic Plan then plans exactly those rooms.
 */
export function RoomsStep({ imageUrl, aspect, layout, onChange, onSuggest, suggesting }: Props) {
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
    if (!active) return;
    const p = at(e);
    if (mode === 'door') {
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
  const prompt = !active
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
          {active && mode === 'door' && (
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
              active ? 'cursor-crosshair' : 'cursor-default',
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
              {live && (
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
          beside it.
        </p>
      </div>
    </div>
  );
}
