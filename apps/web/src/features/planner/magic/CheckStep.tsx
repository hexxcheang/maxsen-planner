import { useState } from 'react';
import { Trash2, TriangleAlert } from 'lucide-react';
import {
  removeRoom,
  renameRoom,
  retypeRoom,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  type FloorAnalysis,
  type RoomType,
} from '@maxsen/domain';
import { IconButton, Input, Select } from '@/components/ui';
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

/** Shows what was read off the drawing over the drawing itself, with quick fixes per room. */
export function CheckStep({ analysis, issues, imageUrl, aspect, onChange }: Props) {
  const [focus, setFocus] = useState<string | null>(null);

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
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-control font-semibold text-ink">Rooms ({analysis.rooms.length})</p>
          <ul aria-label="Rooms" className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
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
          <p className="text-meta text-ink-2">
            Rename or retype rooms that were read wrongly, and remove anything that isn’t a room.
          </p>
        </div>
      </div>
    </div>
  );
}
