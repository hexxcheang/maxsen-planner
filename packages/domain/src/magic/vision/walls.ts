/**
 * Finds the walls of a floor plan and the gaps in them (door openings, windows, passages). Walls are
 * the thickest strokes on the drawing; everything thinner (door swings, furniture, text, dimension
 * lines) is set aside as "ink" and used later to tell what each gap is.
 */
import {
  components,
  countIn,
  darkMask,
  dominantRunLength,
  inkMask,
  open,
  type GrayImage,
  type Mask,
} from './image.ts';

export type Axis = 'h' | 'v';

/** A straight run of wall. `lo..hi` along the axis, `b0..b1` across it (inclusive pixels). */
export interface Bar {
  axis: Axis;
  lo: number;
  hi: number;
  b0: number;
  b1: number;
}

/** A break in a wall between `lo` and `hi` (inclusive) along the axis, `b0..b1` across. */
export interface Gap extends Bar {
  /** How much of the gap is crossed by thin parallel lines (window glazing), 0–1. */
  lined: number;
}

export interface Walls {
  width: number;
  height: number;
  /** Typical wall thickness in pixels. */
  thickness: number;
  wall: Mask;
  /** Thin pen lines that aren't wall. */
  ink: Mask;
  gaps: Gap[];
}

/** Longest gap bridged when nothing (no glazing) is drawn in it, in wall thicknesses. */
export const MAX_OPEN_GAP = 18;
/** Longest glazed gap (window) bridged, in wall thicknesses. */
const MAX_LINED_GAP = 100;

export function findWalls(img: GrayImage): Walls {
  const { width: w, height: h } = img;
  const dark = darkMask(img);
  const t = dominantRunLength(dark, w, h, 4, 60) ?? 3;
  const k = Math.max(3, Math.round(t * 0.6));
  const wall = open(dark, w, h, k);

  // Drop specks that survive the opening (filled arrows, bold glyphs, hatching blobs).
  const { labels, stats } = components(wall, w, h, 1);
  const keep = stats.map((c) => Math.max(c.x1 - c.x0, c.y1 - c.y0) >= 6 * t);
  for (let i = 0; i < wall.length; i++) if (labels[i] && !keep[labels[i]! - 1]) wall[i] = 0;

  const ink = inkMask(img);
  for (let i = 0; i < ink.length; i++) if (wall[i]) ink[i] = 0;
  return { width: w, height: h, thickness: t, wall, ink, gaps: findGaps(wall, ink, w, h, t) };
}

/**
 * Free wall ends and the gap each one faces. Run it again on a mask with gaps already filled to
 * catch walls whose end was cut off by a neighbouring door opening.
 */
export function findGaps(mask: Mask, ink: Mask, w: number, h: number, t: number): Gap[] {
  const minRun = Math.max(2 * t, 8);
  const hMask = runMask(mask, w, h, 'h', minRun);
  const vMask = runMask(mask, w, h, 'v', minRun);
  const bars = [...barsOf(hMask, w, h, 'h'), ...barsOf(vMask, w, h, 'v')];

  const gaps: Gap[] = [];
  for (const bar of bars) {
    const cross = bar.axis === 'h' ? vMask : hMask;
    for (const dir of [-1, 1] as const) {
      if (atJunction(bar, dir, cross, w, h, t)) continue;
      const gap = march(bar, dir, mask, ink, w, h, t);
      if (gap && !gaps.some((g) => sameGap(g, gap))) gaps.push(gap);
    }
  }
  return gaps;
}

/** Pixels belonging to wall runs at least `min` long along the axis. */
function runMask(wall: Mask, w: number, h: number, axis: Axis, min: number): Mask {
  const out = new Uint8Array(w * h);
  const [n, len] = axis === 'h' ? [h, w] : [w, h];
  const at =
    axis === 'h' ? (i: number, j: number) => i * w + j : (i: number, j: number) => j * w + i;
  for (let i = 0; i < n; i++) {
    let start = -1;
    for (let j = 0; j <= len; j++) {
      const on = j < len && wall[at(i, j)] === 1;
      if (on && start < 0) start = j;
      if (!on && start >= 0) {
        if (j - start >= min) for (let k = start; k < j; k++) out[at(i, k)] = 1;
        start = -1;
      }
    }
  }
  return out;
}

function barsOf(mask: Mask, w: number, h: number, axis: Axis): Bar[] {
  return components(mask, w, h, 1).stats.map((c) =>
    axis === 'h'
      ? { axis, lo: c.x0, hi: c.x1, b0: c.y0, b1: c.y1 }
      : { axis, lo: c.y0, hi: c.y1, b0: c.x0, b1: c.x1 },
  );
}

/** Box helper: `along` × `across` ranges to image coordinates. */
function box(axis: Axis, a0: number, a1: number, c0: number, c1: number) {
  return axis === 'h' ? ([a0, c0, a1, c1] as const) : ([c0, a0, c1, a1] as const);
}

/** True when the bar's end meets a crossing wall (a corner or T), so it isn't a free end. */
function atJunction(bar: Bar, dir: -1 | 1, cross: Mask, w: number, h: number, t: number): boolean {
  const end = dir === 1 ? bar.hi : bar.lo;
  const a0 = dir === 1 ? end - (bar.b1 - bar.b0) - 1 : end;
  const a1 = dir === 1 ? end + 1 : end + (bar.b1 - bar.b0) + 2;
  const [x0, y0, x1, y1] = box(bar.axis, a0, a1, bar.b0 - t, bar.b1 + t + 1);
  return countIn(cross, w, h, x0, y0, x1, y1) > 0;
}

/** Walks on from a free wall end until the wall resumes; the stretch in between is a gap. */
function march(
  bar: Bar,
  dir: -1 | 1,
  wall: Mask,
  ink: Mask,
  w: number,
  h: number,
  t: number,
): Gap | null {
  const len = bar.axis === 'h' ? w : h;
  const band = bar.b1 - bar.b0 + 1;
  const at = (a: number, c: number) => (bar.axis === 'h' ? c * w + a : a * w + c);
  const limit = MAX_LINED_GAP * t;
  let lined = 0;
  for (let step = 1; step <= limit; step++) {
    const a = dir === 1 ? bar.hi + step : bar.lo - step;
    if (a < 0 || a >= len) return null;
    let n = 0;
    for (let c = bar.b0; c <= bar.b1; c++) n += wall[at(a, c)]!;
    if (n * 2 >= band) {
      const span = step - 1;
      if (span < 1) return null;
      const share = lined / span;
      if (span > MAX_OPEN_GAP * t && share < 0.6) return null;
      const lo = dir === 1 ? bar.hi + 1 : a + 1;
      return { axis: bar.axis, lo, hi: lo + span - 1, b0: bar.b0, b1: bar.b1, lined: share };
    }
    let glazed = false;
    for (let c = bar.b0 - 1; c <= bar.b1 + 1 && !glazed; c++) {
      const cross = bar.axis === 'h' ? c >= 0 && c < h : c >= 0 && c < w;
      if (cross && ink[at(a, c)]) glazed = true;
    }
    if (glazed) lined++;
  }
  return null;
}

function sameGap(a: Gap, b: Gap): boolean {
  if (a.axis !== b.axis) return false;
  if (a.b1 < b.b0 || b.b1 < a.b0) return false;
  const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
  return overlap > 0.5 * Math.min(a.hi - a.lo, b.hi - b.lo);
}

/** The wall mask with every gap filled in, so rooms become closed regions. */
export function closeGaps(mask: Mask, w: number, gaps: Gap[]): Mask {
  const closed = mask.slice();
  for (const g of gaps) {
    const [x0, y0, x1, y1] = box(g.axis, g.lo, g.hi, g.b0, g.b1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) closed[y * w + x] = 1;
  }
  return closed;
}
