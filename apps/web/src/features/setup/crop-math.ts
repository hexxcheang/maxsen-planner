import type { CropRect } from '@maxsen/domain';

export type Grip = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Smallest crop, as a fraction of the page side. */
const MIN = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Applies a drag of (dx, dy) (fractions of the page) on one grip of the crop. */
export function dragCrop(c: CropRect, grip: Grip, dx: number, dy: number): CropRect {
  if (grip === 'move') {
    return { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) };
  }
  let x0 = c.x;
  let y0 = c.y;
  let x1 = c.x + c.w;
  let y1 = c.y + c.h;
  if (grip.includes('w')) x0 = clamp(x0 + dx, 0, x1 - MIN);
  if (grip.includes('e')) x1 = clamp(x1 + dx, x0 + MIN, 1);
  if (grip.includes('n')) y0 = clamp(y0 + dy, 0, y1 - MIN);
  if (grip.includes('s')) y1 = clamp(y1 + dy, y0 + MIN, 1);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
