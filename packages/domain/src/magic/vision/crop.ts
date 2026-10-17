/**
 * Suggests how to crop a drawing page to just the floor plan: the walls' extent plus a margin for
 * the dimension lines and labels around them, leaving out sheet borders, title blocks and blank
 * paper.
 */
import type { CropRect } from '../../types.ts';
import { components, type GrayImage } from './image.ts';
import { findWalls } from './walls.ts';

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export function suggestCrop(img: GrayImage): CropRect {
  const { width: w, height: h } = img;
  const walls = findWalls(img);
  const { stats } = components(walls.wall, w, h, 1);
  // Ignore a sheet frame (spans the page) and specks.
  const parts = stats.filter((c) => {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    return !(bw > 0.85 * w && bh > 0.85 * h) && Math.max(bw, bh) >= 8 * walls.thickness;
  });
  if (parts.length === 0) return FULL;

  // Start from the largest piece of wall and take in pieces close to it (the rest of the plan),
  // but not far-off ones (a title block, a key plan, a second drawing).
  parts.sort((a, b) => b.area - a.area);
  const box = { ...parts[0]! };
  const reach = Math.max(w, h) * 0.06;
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of parts) {
      const inside = c.x0 >= box.x0 && c.x1 <= box.x1 && c.y0 >= box.y0 && c.y1 <= box.y1;
      if (inside) continue;
      const gapX = Math.max(0, c.x0 - box.x1, box.x0 - c.x1);
      const gapY = Math.max(0, c.y0 - box.y1, box.y0 - c.y1);
      if (gapX <= reach && gapY <= reach) {
        box.x0 = Math.min(box.x0, c.x0);
        box.y0 = Math.min(box.y0, c.y0);
        box.x1 = Math.max(box.x1, c.x1);
        box.y1 = Math.max(box.y1, c.y1);
        grew = true;
      }
    }
  }

  const pad = Math.max(0.02 * Math.max(box.x1 - box.x0, box.y1 - box.y0), 3 * walls.thickness);
  const x0 = Math.max(0, box.x0 - pad);
  const y0 = Math.max(0, box.y0 - pad);
  const x1 = Math.min(w, box.x1 + 1 + pad);
  const y1 = Math.min(h, box.y1 + 1 + pad);
  // A plan filling most of the page needs no crop.
  if ((x1 - x0) * (y1 - y0) > 0.92 * w * h) return FULL;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { x: r(x0 / w), y: r(y0 / h), w: r((x1 - x0) / w), h: r((y1 - y0) / h) };
}
