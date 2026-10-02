/**
 * Finds windows on a floor plan: breaks in the wall that are spanned by thin parallel glazing
 * lines (how windows are drawn on architectural plans), usually on the outer walls.
 */
import type { GrayImage } from './image.ts';
import { findWalls } from './walls.ts';

/** A window as fractions (0–1) of the drawing: one end to the other, along the wall. */
export interface FoundWindow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function findWindows(img: GrayImage): FoundWindow[] {
  const { width: w, height: h, thickness: t, gaps } = findWalls(img);
  return gaps
    .filter((g) => g.lined >= 0.6 && g.hi - g.lo + 1 >= 3 * t)
    .map((g) => {
      const c = (g.b0 + g.b1 + 1) / 2;
      const r = (n: number) => Math.round(n * 10000) / 10000;
      return g.axis === 'h'
        ? { x1: r(g.lo / w), y1: r(c / h), x2: r((g.hi + 1) / w), y2: r(c / h) }
        : { x1: r(c / w), y1: r(g.lo / h), x2: r(c / w), y2: r((g.hi + 1) / h) };
    });
}
