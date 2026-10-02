import type { Rotation } from '../../types.ts';
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
