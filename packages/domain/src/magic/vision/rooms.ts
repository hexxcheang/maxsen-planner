/**
 * Reads rooms off a floor plan: the walls (with door openings and windows bridged) close each room
 * into a region, so a tap inside a room finds its whole floor. The region becomes one box, or a few
 * for an L-shaped or odd-shaped room, and the widest plain opening in its walls is its door.
 */
import { components, type GrayImage } from './image.ts';
import { closeGaps, findGaps, findWalls, MAX_OPEN_GAP, type Gap } from './walls.ts';

export interface FoundBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FoundRoom {
  /** The room's main rectangle and any more it needs (as fractions of the drawing). */
  box: FoundBox;
  parts: FoundBox[];
  /** The middle of its door opening, or null when no plain opening was found. */
  door: { x: number; y: number } | null;
  /** Floor area as a share of the drawing. */
  share: number;
}

/** A region bigger than this share of the drawing isn't a room (the walls didn't close). */
const MAX_SHARE = 0.4;
const MIN_SHARE = 0.0015;
/** Rectangles a room is described with, at most, and the smallest worth adding. */
const MAX_BOXES = 3;
const MIN_PART = 0.08;

export interface RoomReader {
  /** The room around a tap at (x, y), as fractions of the drawing; null if no closed room. */
  at: (x: number, y: number) => FoundRoom | null;
  /** Every closed room on the drawing, largest first. */
  all: () => FoundRoom[];
}

/** Build once per drawing; each tap is then quick. */
export function roomReader(img: GrayImage): RoomReader {
  const { width: w, height: h } = img;
  const walls = findWalls(img);
  const t = walls.thickness;
  let closed = closeGaps(walls.wall, w, walls.gaps);
  // Walls whose end was cut off by a neighbouring opening show up once the first gaps are closed.
  const more = findGaps(closed, walls.ink, w, h, t);
  closed = closeGaps(closed, w, more);
  const gaps = [...walls.gaps, ...more];
  const { labels, stats } = components(closed, w, h, 0);
  const total = w * h;
  const minSide = 3 * t;
  const valid = (label: number) => {
    const c = stats[label - 1];
    if (!c || c.touchesBorder) return false;
    const share = c.area / total;
    return (
      share >= MIN_SHARE && share <= MAX_SHARE && c.x1 - c.x0 >= minSide && c.y1 - c.y0 >= minSide
    );
  };
  const cache = new Map<number, FoundRoom>();
  const room = (label: number) => {
    let r = cache.get(label);
    if (!r) {
      r = describe(label, labels, stats[label - 1]!, w, h, t, gaps);
      cache.set(label, r);
    }
    return r;
  };

  return {
    at(fx, fy) {
      const px = Math.round(fx * (w - 1));
      const py = Math.round(fy * (h - 1));
      // On a wall line? Take the nearest floor.
      for (let r = 0; r <= 2 * t; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = px + dx;
            const y = py + dy;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const label = labels[y * w + x]!;
            if (label) return valid(label) ? room(label) : null;
          }
        }
      }
      return null;
    },
    all() {
      return stats
        .filter((c) => valid(c.label))
        .sort((a, b) => b.area - a.area)
        .map((c) => room(c.label));
    },
  };
}

function describe(
  label: number,
  labels: Int32Array,
  c: { x0: number; y0: number; x1: number; y1: number; area: number },
  w: number,
  h: number,
  t: number,
  gaps: Gap[],
): FoundRoom {
  // The region on a coarse grid, a cell counting when it's mostly floor.
  const s = Math.max(2, Math.round(t));
  const gw = Math.ceil((c.x1 - c.x0 + 1) / s);
  const gh = Math.ceil((c.y1 - c.y0 + 1) / s);
  const cells = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let n = 0;
      let m = 0;
      for (let y = c.y0 + gy * s; y < Math.min(c.y1 + 1, c.y0 + (gy + 1) * s); y++) {
        for (let x = c.x0 + gx * s; x < Math.min(c.x1 + 1, c.x0 + (gx + 1) * s); x++) {
          m++;
          if (labels[y * w + x] === label) n++;
        }
      }
      cells[gy * gw + gx] = n * 2 >= m ? 1 : 0;
    }
  }
  const filled = cells.reduce((a, b) => a + b, 0);

  // Largest rectangles first, until what's left is too small to matter.
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const left = cells.slice();
  while (rects.length < MAX_BOXES) {
    const r = largestRectangle(left, gw, gh);
    if (!r || r.w * r.h < (rects.length ? MIN_PART : 0) * filled) break;
    rects.push(r);
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) left[y * gw + x] = 0;
  }
  const round = (n: number) => Math.round(n * 10000) / 10000;
  // Out to the middle of the walls around, so boxes meet like the rooms do.
  const pad = t / 2;
  const toBox = (r: { x: number; y: number; w: number; h: number }): FoundBox => {
    const x0 = Math.max(0, c.x0 + r.x * s - pad);
    const y0 = Math.max(0, c.y0 + r.y * s - pad);
    const x1 = Math.min(w, Math.min(c.x1 + 1, c.x0 + (r.x + r.w) * s) + pad);
    const y1 = Math.min(h, Math.min(c.y1 + 1, c.y0 + (r.y + r.h) * s) + pad);
    return { x: round(x0 / w), y: round(y0 / h), w: round((x1 - x0) / w), h: round((y1 - y0) / h) };
  };
  const boxes = rects.length ? rects.map(toBox) : [toBox({ x: 0, y: 0, w: gw, h: gh })];

  // The door: the widest plain (unglazed) opening this room's floor reaches.
  let door: { x: number; y: number } | null = null;
  let widest = 0;
  for (const g of gaps) {
    const span = g.hi - g.lo + 1;
    if (g.lined >= 0.6 || span < 2 * t || span > MAX_OPEN_GAP * t || span <= widest) continue;
    const mid = Math.round((g.lo + g.hi) / 2);
    let touches = false;
    for (let k = 1; k <= 2 * t && !touches; k++) {
      for (const side of [g.b0 - k, g.b1 + k]) {
        const [x, y] = g.axis === 'h' ? [mid, side] : [side, mid];
        if (x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === label) touches = true;
      }
    }
    if (!touches) continue;
    widest = span;
    const across = (g.b0 + g.b1 + 1) / 2;
    const [x, y] = g.axis === 'h' ? [mid + 0.5, across] : [across, mid + 0.5];
    door = { x: round(x / w), y: round(y / h) };
  }

  return { box: boxes[0]!, parts: boxes.slice(1), door, share: c.area / (w * h) };
}

/** The largest all-set rectangle in a grid (cells), by the histogram method. */
function largestRectangle(
  cells: Uint8Array,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } | null {
  const heights = new Int32Array(w);
  let best: { x: number; y: number; w: number; h: number } | null = null;
  let bestArea = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) heights[x] = cells[y * w + x] ? heights[x]! + 1 : 0;
    const stack: number[] = [];
    for (let x = 0; x <= w; x++) {
      const cur = x < w ? heights[x]! : 0;
      while (stack.length && heights[stack[stack.length - 1]!]! >= cur) {
        const top = stack.pop()!;
        const height = heights[top]!;
        const left = stack.length ? stack[stack.length - 1]! + 1 : 0;
        const area = height * (x - left);
        if (height > 0 && area > bestArea) {
          bestArea = area;
          best = { x: left, y: y - height + 1, w: x - left, h: height };
        }
      }
      stack.push(x);
    }
  }
  return best;
}
