import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { CropRect } from '@maxsen/domain';
import { cn } from '@/lib/cn';
import { dragCrop, type Grip } from './crop-math';

interface Props {
  imageUrl: string;
  /** Width / height of the image. */
  aspect: number;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
}

const GRIPS: { grip: Grip; label: string; className: string }[] = [
  { grip: 'nw', label: 'Top-left corner', className: '-left-2 -top-2 cursor-nwse-resize' },
  { grip: 'ne', label: 'Top-right corner', className: '-right-2 -top-2 cursor-nesw-resize' },
  { grip: 'sw', label: 'Bottom-left corner', className: '-bottom-2 -left-2 cursor-nesw-resize' },
  { grip: 'se', label: 'Bottom-right corner', className: '-bottom-2 -right-2 cursor-nwse-resize' },
  { grip: 'n', label: 'Top edge', className: '-top-2 left-1/2 -ml-2 cursor-ns-resize' },
  { grip: 's', label: 'Bottom edge', className: '-bottom-2 left-1/2 -ml-2 cursor-ns-resize' },
  { grip: 'w', label: 'Left edge', className: '-left-2 top-1/2 -mt-2 cursor-ew-resize' },
  { grip: 'e', label: 'Right edge', className: '-right-2 top-1/2 -mt-2 cursor-ew-resize' },
];

/**
 * The page with a crop rectangle over it: drag inside to move it, drag a handle to resize, or use
 * the arrow keys on a focused handle (Shift for bigger steps). Outside the crop is dimmed.
 */
export function CropBox({ imageUrl, aspect, crop, onChange }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grip: Grip; x: number; y: number; start: CropRect } | null>(null);

  const begin = (grip: Grip) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { grip, x: e.clientX, y: e.clientY, start: crop };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!d || !box) return;
    onChange(
      dragCrop(d.start, d.grip, (e.clientX - d.x) / box.width, (e.clientY - d.y) / box.height),
    );
  };
  const end = () => {
    drag.current = null;
  };
  const nudge = (grip: Grip) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange(dragCrop(crop, grip, d[0]!, d[1]!));
  };

  const pct = (n: number) => `${n * 100}%`;
  return (
    <div
      ref={frame}
      className="relative max-h-full max-w-full touch-none select-none border border-rule-2 bg-surface"
      style={{
        aspectRatio: String(aspect),
        height: aspect < 1.4 ? '100%' : undefined,
        width: aspect >= 1.4 ? '100%' : undefined,
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img
        src={imageUrl}
        alt="Selected drawing"
        className="absolute inset-0 size-full"
        draggable={false}
      />
      {/* Dim everything outside the crop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-ink/45"
        style={{
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(crop.x)} ${pct(crop.y)}, ${pct(crop.x)} ${pct(crop.y + crop.h)}, ${pct(crop.x + crop.w)} ${pct(crop.y + crop.h)}, ${pct(crop.x + crop.w)} ${pct(crop.y)}, ${pct(crop.x)} ${pct(crop.y)})`,
        }}
      />
      <div
        role="group"
        aria-label="Crop"
        data-crop={`${crop.x.toFixed(3)},${crop.y.toFixed(3)},${crop.w.toFixed(3)},${crop.h.toFixed(3)}`}
        className="absolute cursor-move outline outline-2 outline-brass"
        style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
        onPointerDown={begin('move')}
      >
        {GRIPS.map((g) => (
          <button
            key={g.grip}
            type="button"
            aria-label={`${g.label} of the crop`}
            className={cn(
              'absolute size-4 rounded-full border-2 border-brass bg-surface focus-visible:outline-offset-1',
              g.className,
            )}
            onPointerDown={begin(g.grip)}
            onKeyDown={nudge(g.grip)}
          />
        ))}
      </div>
    </div>
  );
}
