import { useState } from 'react';
import { ArrowLeftRight, DoorOpen, FlipHorizontal2, Trash2, TriangleAlert } from 'lucide-react';
import {
  flipDoorSwing,
  removeDoor,
  removeRoom,
  renameRoom,
  retypeRoom,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  setMainEntrance,
  swapDoorHinge,
  type FloorAnalysis,
  type RoomType,
} from '@maxsen/domain';
import { IconButton, Input, SegmentedControl, Select } from '@/components/ui';
import { cn } from '@/lib/cn';

interface Props {
  analysis: FloorAnalysis;
  issues: string[];
  /** The drawing the analysis was read from. */
  imageUrl: string;
  aspect: number;
  onChange: (analysis: FloorAnalysis) => void;
}

const TYPE_OPTIONS = ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }));

/** Shows what was read off the drawing over the drawing itself, with quick fixes per room and door. */
export function CheckStep({ analysis, issues, imageUrl, aspect, onChange }: Props) {
  const [tab, setTab] = useState<'rooms' | 'doors'>('rooms');
  const [focus, setFocus] = useState<string | null>(null);
  const roomName = (id: string | null) =>
    id === null ? 'Outside' : (analysis.rooms.find((r) => r.id === id)?.name ?? 'Outside');
  const number = new Map(analysis.rooms.map((r, i) => [r.id, i + 1]));

  return (
    <div className="flex flex-col gap-4">
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l-[3px] border-warn bg-warn-tint px-3 py-2">
          {issues.map((i) => (
            <li key={i} className="flex items-start gap-2 text-control text-ink">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
              {i}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[700px]:grid-cols-1">
        <div
          className="relative self-start overflow-hidden border border-rule bg-surface"
          style={{ aspectRatio: String(aspect) }}
        >
          <img src={imageUrl} alt="" className="absolute inset-0 size-full opacity-60" />
          <svg
            aria-label="What Magic Plan read"
            viewBox={`0 0 1000 ${1000 / aspect}`}
            className="absolute inset-0 size-full"
          >
            {analysis.rooms.map((r, i) => {
              const H = 1000 / aspect;
              const on = focus === r.id;
              return (
                <g key={r.id}>
                  <rect
                    x={r.x * 1000}
                    y={r.y * H}
                    width={r.w * 1000}
                    height={r.h * H}
                    fill={on ? 'rgba(168,135,58,0.28)' : 'rgba(168,135,58,0.08)'}
                    stroke="#A8873A"
                    strokeWidth={on ? 4 : 1.5}
                  />
                  <circle
                    cx={(r.x + r.w / 2) * 1000}
                    cy={(r.y + r.h / 2) * H}
                    r={16}
                    fill="#876B29"
                  />
                  <text
                    x={(r.x + r.w / 2) * 1000}
                    y={(r.y + r.h / 2) * H + 7}
                    textAnchor="middle"
                    fontSize={20}
                    fontWeight={600}
                    fill="#FFFFFF"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
            {analysis.doors.map((d) => {
              const H = 1000 / aspect;
              const on = focus === d.id;
              const color = d.isMainEntrance ? '#3E7A4F' : '#B4433A';
              return (
                <g key={d.id}>
                  <line
                    x1={d.hinge.x * 1000}
                    y1={d.hinge.y * H}
                    x2={d.latch.x * 1000}
                    y2={d.latch.y * H}
                    stroke={color}
                    strokeWidth={on ? 12 : 7}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={d.hinge.x * 1000}
                    cy={d.hinge.y * H}
                    r={on ? 10 : 7}
                    fill="#FFFFFF"
                    stroke={color}
                    strokeWidth={3}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <SegmentedControl
            label="Check"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'rooms', label: `Rooms (${analysis.rooms.length})` },
              { value: 'doors', label: `Doors (${analysis.doors.length})` },
            ]}
          />
          {tab === 'rooms' ? (
            <ul
              aria-label="Rooms"
              className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1"
            >
              {analysis.rooms.map((r, i) => (
                <li
                  key={r.id}
                  className={cn('flex items-center gap-2', focus === r.id && 'bg-brass-tint')}
                  onPointerEnter={() => setFocus(r.id)}
                  onPointerLeave={() => setFocus(null)}
                  onFocus={() => setFocus(r.id)}
                >
                  <span className="tnum w-5 shrink-0 text-right text-meta text-ink-2">{i + 1}</span>
                  <Input
                    compact
                    className="min-w-0 flex-1"
                    aria-label={`Room ${i + 1} name`}
                    value={r.name}
                    onChange={(e) => onChange(renameRoom(analysis, r.id, e.target.value))}
                  />
                  <div className="w-[136px] shrink-0">
                    <Select
                      compact
                      aria-label={`Room ${i + 1} type`}
                      value={r.type}
                      options={TYPE_OPTIONS}
                      onChange={(t) => onChange(retypeRoom(analysis, r.id, t as RoomType))}
                    />
                  </div>
                  <IconButton
                    size="sm"
                    label={`Remove room ${i + 1}`}
                    icon={<Trash2 className="size-4" />}
                    disabled={analysis.rooms.length <= 1}
                    onClick={() => onChange(removeRoom(analysis, r.id))}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul
              aria-label="Doors"
              className="flex max-h-[340px] flex-col gap-1 overflow-y-auto pr-1"
            >
              {analysis.doors.length === 0 && (
                <li className="text-control text-ink-2">No doors found on this drawing.</li>
              )}
              {analysis.doors.map((d, i) => {
                const [into, other] = d.sides;
                const label = `Door ${i + 1}`;
                return (
                  <li
                    key={d.id}
                    className={cn(
                      'flex items-center gap-1 py-0.5',
                      focus === d.id && 'bg-brass-tint',
                    )}
                    onPointerEnter={() => setFocus(d.id)}
                    onPointerLeave={() => setFocus(null)}
                    onFocus={() => setFocus(d.id)}
                  >
                    <span className="min-w-0 flex-1 text-control text-ink">
                      <span className="font-medium">{label}</span>{' '}
                      <span className="text-ink-2">
                        opens into {roomName(into)}
                        {into ? ` ${number.get(into)}` : ''} from {roomName(other)}
                        {other ? ` ${number.get(other)}` : ''}
                      </span>
                      {d.isMainEntrance && (
                        <span className="ml-1.5 text-meta font-semibold text-ok">
                          Main entrance
                        </span>
                      )}
                    </span>
                    <IconButton
                      size="sm"
                      label={`${label}: swings into the other room`}
                      icon={<ArrowLeftRight className="size-4" />}
                      onClick={() => onChange(flipDoorSwing(analysis, d.id))}
                    />
                    <IconButton
                      size="sm"
                      label={`${label}: hinged at the other end`}
                      icon={<FlipHorizontal2 className="size-4" />}
                      onClick={() => onChange(swapDoorHinge(analysis, d.id))}
                    />
                    <IconButton
                      size="sm"
                      label={
                        d.isMainEntrance
                          ? `${label}: not the main entrance`
                          : `${label}: make main entrance`
                      }
                      active={d.isMainEntrance}
                      icon={<DoorOpen className="size-4" />}
                      onClick={() =>
                        onChange(setMainEntrance(analysis, d.isMainEntrance ? null : d.id))
                      }
                    />
                    <IconButton
                      size="sm"
                      label={`Remove ${label.toLowerCase()}`}
                      icon={<Trash2 className="size-4" />}
                      onClick={() => onChange(removeDoor(analysis, d.id))}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-meta text-ink-2">
            Red lines are doors (the dot is the hinge); green is the main entrance.
          </p>
        </div>
      </div>
    </div>
  );
}
