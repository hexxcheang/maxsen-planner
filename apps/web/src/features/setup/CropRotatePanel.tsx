import { useState } from 'react';
import type { Plan, Rotation } from '@maxsen/domain';
import { Button, LATER_PHASE, SectionTitle, SegmentedControl } from '@/components/ui';
import { fileUrl } from '@/lib/files';

const HANDLES = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1],
] as const;

/** Rotation and crop preview. Phase A shows the controls; dragging the crop arrives in Phase C. */
export function CropRotatePanel({ plan, title }: { plan: Plan; title: string }) {
  const [rotation, setRotation] = useState<Rotation>(plan.background.rotation);
  const crop = plan.background.crop;
  const quarter = rotation === 90 || rotation === 270;

  return (
    <section aria-label="Crop and rotation" className="border border-rule bg-surface">
      <div className="border-b border-rule px-4 py-2.5">
        <SectionTitle as="h3">Crop and rotation, {title}</SectionTitle>
      </div>
      <div className="flex items-center justify-center overflow-hidden bg-desk p-6">
        <div
          className="relative"
          style={{ width: quarter ? '50%' : '70%', aspectRatio: quarter ? '5 / 7' : '7 / 5' }}
        >
          <img
            src={fileUrl(plan.background.fileId)}
            alt="Drawing being adjusted"
            className="absolute top-1/2 left-1/2 max-w-none border border-rule-2 bg-surface transition-transform duration-[var(--dur-panel)]"
            style={{
              width: quarter ? `${(7 / 5) * 100}%` : '100%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
          />
          <div
            aria-hidden
            className="absolute border-2 border-brass shadow-[0_0_0_9999px_rgba(31,29,26,.18)]"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
            }}
          >
            {HANDLES.map(([x, y]) => (
              <span
                key={`${x}-${y}`}
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 border border-brass bg-surface"
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <SegmentedControl<string>
          label="Rotation"
          size="sm"
          value={String(rotation)}
          onChange={(v) => setRotation(Number(v) as Rotation)}
          options={[0, 90, 180, 270].map((r) => ({ value: String(r), label: `${r}°` }))}
        />
        <span className="ml-auto flex gap-2">
          <Button size="sm" disabledReason={LATER_PHASE}>
            Reset crop
          </Button>
          <Button size="sm" variant="primary" disabledReason={LATER_PHASE}>
            Use this drawing
          </Button>
        </span>
      </div>
    </section>
  );
}
