import type { CropRect, Rotation } from '../../types.ts';
import type { DrawingLabel } from './read-floor-plan.ts';

/** Moves a label read off the original page onto the page turned clockwise by `rotation`. */
export function rotateLabel(label: DrawingLabel, rotation: Rotation): DrawingLabel {
  const { x, y } = label;
  switch (rotation) {
    case 90:
      return { ...label, x: 1 - y, y: x };
    case 180:
      return { ...label, x: 1 - x, y: 1 - y };
    case 270:
      return { ...label, x: y, y: 1 - x };
    default:
      return label;
  }
}

/** Moves a label onto a cropped page; null when it falls outside the crop. */
export function cropLabel(label: DrawingLabel, crop: CropRect): DrawingLabel | null {
  const x = (label.x - crop.x) / crop.w;
  const y = (label.y - crop.y) / crop.h;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { ...label, x, y };
}
