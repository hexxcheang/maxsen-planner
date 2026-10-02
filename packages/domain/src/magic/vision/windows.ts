/**
 * Finds windows on a floor plan. Plans draw walls solid black and glazing as two or three thin
 * parallel lines, in a break in a wall or between the structural columns of the façade (how HDB
 * and condo brochure plans show it); on a scanned or screenshotted plan those lines blur into one
 * grey band, heavier than a single line. A window is always on the outside of the home: past it
 * there's nothing but open air (and dimension lines), or a balcony whose own railing is open.
 * Thin walls inside the flat look like glazing, so a pane with a wall or room beyond it on both
 * sides is left out.
 */
import {
  components,
  dominantRunLength,
  open,
  otsuThreshold,
  type GrayImage,
  type Mask,
} from './image.ts';
import type { Axis } from './walls.ts';

/** A window as fractions (0–1) of the drawing: one end to the other, along the wall. */
export interface FoundWindow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A run of glazing: `a0..a1` along the axis, `c0..c1` across it (inclusive pixels). */
interface Glazing {
  axis: Axis;
  a0: number;
  a1: number;
  c0: number;
  c1: number;
}

interface Geometry {
  w: number;
  h: number;
  /** Wall thickness in pixels. */
  t: number;
  /** Solid wall and columns. */
  wall: Mask;
  /** How dark each thin-line pixel is (0 where there's no thin line). */
  ink: Uint8Array;
  /** Thin lines at least a window long, per axis. */
  lines: Record<Axis, Mask>;
  /** Furthest apart the lines of one pane (or one thin wall) are drawn. */
  spacing: number;
  /** How much ink a single thin line puts across itself; a pane carries at least twice that. */
  single: number;
}

/** Darker than this is solid wall… */
const SOLID = 100;
/** …and darker than this is a pen line. */
const PEN = 200;
/** Shortest window, in wall thicknesses. */
const MIN_LENGTH = 4;
/** A pane carries this many times the ink of a single line. */
const PANE = 2.1;
/** Furthest a balcony's railing can be from the glazing behind it, in wall thicknesses. */
const MAX_BALCONY_DEPTH = 10;

export function findWindows(img: GrayImage): FoundWindow[] {
  const geo = geometry(img);
  const minLength = Math.max(MIN_LENGTH * geo.t, 16);
  const candidates = (['h', 'v'] as const).flatMap((axis) => glazing(geo, axis, minLength));

  // Façade glazing first, then glazing that looks out through a balcony's railing.
  const found: Glazing[] = [];
  for (let pass = 0; pass < 3; pass++) {
    const before = found.length;
    for (const g of candidates) {
      if (found.includes(g)) continue;
      const sides = ([-1, 1] as const).map((dir) => look(geo, g, dir, found));
      if (sides.includes('open') && sides.includes('blocked')) found.push(g);
    }
    if (found.length === before) break;
  }

  const { w, h } = geo;
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return found.map((g) => {
    const c = (g.c0 + g.c1 + 1) / 2;
    return g.axis === 'h'
      ? { x1: r(g.a0 / w), y1: r(c / h), x2: r((g.a1 + 1) / w), y2: r(c / h) }
      : { x1: r(c / w), y1: r(g.a0 / h), x2: r(c / w), y2: r((g.a1 + 1) / h) };
  });
}

const lengthOf = (g: { w: number; h: number }, axis: Axis) => (axis === 'h' ? g.w : g.h);
const acrossOf = (g: { w: number; h: number }, axis: Axis) => (axis === 'h' ? g.h : g.w);
const indexer = (w: number, axis: Axis) =>
  axis === 'h' ? (a: number, c: number) => c * w + a : (a: number, c: number) => a * w + c;

function geometry(img: GrayImage): Geometry {
  const { width: w, height: h, data } = img;
  const cut = Math.min(otsuThreshold(img), SOLID);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < solid.length; i++) solid[i] = data[i]! < cut ? 1 : 0;
  const t = dominantRunLength(solid, w, h, 3, 80) ?? 4;
  const wall = open(solid, w, h, Math.max(3, Math.round(t * 0.6)));
  // Drop specks that survive the opening (bold glyphs, arrow heads), keeping façade columns.
  const { labels, stats } = components(wall, w, h, 1);
  const keep = stats.map((c) => Math.max(c.x1 - c.x0, c.y1 - c.y0) >= 2 * t);
  for (let i = 0; i < wall.length; i++) if (labels[i] && !keep[labels[i]! - 1]) wall[i] = 0;

  // Thin lines: pen-dark pixels clear of the walls' soft edges.
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = data[i]!;
      if (v >= PEN) continue;
      let nearWall = false;
      for (let dy = -2; dy <= 2 && !nearWall; dy++) {
        for (let dx = -2; dx <= 2 && !nearWall; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && wall[yy * w + xx]) nearWall = true;
        }
      }
      if (!nearWall) ink[i] = PEN - v;
    }
  }
  const minLength = Math.max(MIN_LENGTH * t, 16);
  const geo: Geometry = {
    w,
    h,
    t,
    wall,
    ink,
    lines: { h: longLines(ink, w, h, 'h', minLength), v: longLines(ink, w, h, 'v', minLength) },
    spacing: Math.max(Math.round(0.8 * t), 6),
    single: Infinity,
  };
  geo.single = singleLineInk(geo);
  return geo;
}

/** Thin straight lines along the axis at least `min` long (bridging small breaks). */
function longLines(ink: Uint8Array, w: number, h: number, axis: Axis, min: number): Mask {
  const out = new Uint8Array(w * h);
  const at = indexer(w, axis);
  const len = lengthOf({ w, h }, axis);
  const across = acrossOf({ w, h }, axis);
  for (let c = 0; c < across; c++) {
    let start = -1;
    let last = -10;
    let count = 0;
    const flush = () => {
      // Solid along nearly all its length, unlike a row of lettering.
      if (start >= 0 && last - start + 1 >= min && count >= 0.9 * (last - start + 1)) {
        for (let a = start; a <= last; a++) if (ink[at(a, c)]) out[at(a, c)] = 1;
      }
    };
    for (let a = 0; a < len; a++) {
      if (!ink[at(a, c)]) continue;
      if (a - last > 4) {
        flush();
        start = a;
        count = 0;
      }
      last = a;
      count++;
    }
    flush();
  }
  return out;
}

/** One thin line where it crosses an along position: its across range and the ink it carries. */
interface Blob {
  c0: number;
  c1: number;
  mass: number;
}

/** The long lines crossing along-position `a` between `c0` and `c1`. */
function blobsAt(geo: Geometry, axis: Axis, a: number, c0: number, c1: number): Blob[] {
  const at = indexer(geo.w, axis);
  const lines = geo.lines[axis];
  const out: Blob[] = [];
  for (let c = Math.max(0, c0); c <= Math.min(acrossOf(geo, axis) - 1, c1); c++) {
    const i = at(a, c);
    if (!lines[i]) continue;
    const prev = out[out.length - 1];
    if (prev && prev.c1 === c - 1) {
      prev.c1 = c;
      prev.mass += geo.ink[i]!;
    } else out.push({ c0: c, c1: c, mass: geo.ink[i]! });
  }
  return out;
}

/** Blobs grouped with their neighbours closer than `spacing`: a pane, a thin wall, or one line. */
function clusters(geo: Geometry, blobs: Blob[]): Blob[][] {
  const out: Blob[][] = [];
  for (const b of blobs) {
    const last = out[out.length - 1];
    if (last && b.c0 - last[last.length - 1]!.c1 - 1 <= geo.spacing) last.push(b);
    else out.push([b]);
  }
  return out;
}

const isPane = (geo: Geometry, group: Blob[]) =>
  group.length >= 2 || group.reduce((s, b) => s + b.mass, 0) >= PANE * geo.single;

/** The typical ink across a single thin line: the median over lines standing on their own. */
function singleLineInk(geo: Geometry): number {
  const masses: number[] = [];
  for (const axis of ['h', 'v'] as const) {
    const len = lengthOf(geo, axis);
    const across = acrossOf(geo, axis);
    const step = Math.max(2, Math.round(geo.t / 2));
    for (let a = 0; a < len; a += step) {
      for (const group of clusters(geo, blobsAt(geo, axis, a, 0, across - 1))) {
        if (group.length === 1) masses.push(group[0]!.mass);
      }
    }
  }
  if (masses.length < 20) return Infinity;
  masses.sort((x, y) => x - y);
  return masses[Math.floor(masses.length / 2)]!;
}

/**
 * Stretches where a pane of glazing runs along the axis with no solid wall alongside: glazing, or
 * a thin wall drawn like it.
 */
function glazing(geo: Geometry, axis: Axis, minLength: number): Glazing[] {
  const { w, t, wall, spacing } = geo;
  const at = indexer(w, axis);
  const len = lengthOf(geo, axis);
  const across = acrossOf(geo, axis);
  const out: Glazing[] = [];

  // Across positions where some long line lies, grouped into bands of nearby lines.
  const rows = new Uint8Array(across);
  for (let c = 0; c < across; c++) {
    for (let a = 0; a < len && !rows[c]; a++) if (geo.lines[axis][at(a, c)]) rows[c] = 1;
  }
  for (let c = 0; c < across; c++) {
    if (!rows[c]) continue;
    let bandEnd = c;
    for (let k = c; k < across && k - bandEnd <= spacing; k++) if (rows[k]) bandEnd = k;
    const c0 = c;
    const c1 = bandEnd;
    c = bandEnd;

    // Along the band: where a pane runs with no wall beside it.
    let start = -1;
    let end = -1;
    let misses = 0;
    let lo = c1;
    let hi = c0;
    let filled = 0;
    const flush = () => {
      // Lettering has strokes between its top and bottom edges; glazing is clear between lines.
      if (start >= 0 && end - start + 1 >= minLength && filled <= 0.25 * (end - start + 1)) {
        out.push({ axis, a0: start, a1: end, c0: lo, c1: hi });
      }
      start = -1;
      filled = 0;
      lo = c1;
      hi = c0;
    };
    for (let a = 0; a <= len; a++) {
      let pane: Blob[] | undefined;
      if (a < len) {
        pane = clusters(geo, blobsAt(geo, axis, a, c0, c1)).find((g) => isPane(geo, g));
        if (pane) {
          const p0 = pane[0]!.c0;
          const p1 = pane[pane.length - 1]!.c1;
          for (let k = p0 - t; k <= p1 + t && pane; k++) {
            if (k >= 0 && k < across && wall[at(a, k)]) pane = undefined;
          }
        }
      }
      if (pane) {
        if (start < 0) start = a;
        end = a;
        misses = 0;
        for (let i = 1; i < pane.length; i++) {
          let between = false;
          for (let k = pane[i - 1]!.c1 + 2; k <= pane[i]!.c0 - 2 && !between; k++) {
            if (geo.ink[at(a, k)]) between = true;
          }
          if (between) {
            filled++;
            break;
          }
        }
        lo = Math.min(lo, pane[0]!.c0);
        hi = Math.max(hi, pane[pane.length - 1]!.c1);
      } else if (start >= 0 && ++misses > Math.max(2, t / 2)) {
        flush();
        misses = 0;
      }
    }
    flush();
  }
  return out;
}

/**
 * What lies past a run of glazing on one side: `open` when the drawing ends with nothing but
 * single lines (dimensions, grid lines) on the way, `blocked` at a solid wall or another pane or
 * thin wall (the next room). Glazing already found counts as see-through when it's close by with
 * nothing else in between, so the doors onto a balcony count too.
 */
function look(geo: Geometry, g: Glazing, dir: -1 | 1, found: Glazing[]): 'open' | 'blocked' {
  const { w, wall, spacing, t } = geo;
  const at = indexer(w, g.axis);
  const lines = geo.lines[g.axis];
  const across = acrossOf(geo, g.axis);
  const span = g.a1 - g.a0 + 1;
  const step = Math.max(1, Math.floor(span / 64));
  const samples = Math.ceil(span / step);
  let seeThrough = found.filter((f) => f !== g);
  const from = dir < 0 ? g.c0 : g.c1;

  let lastEnd = -Infinity;
  let runStart = -1;
  let runMass = 0;
  let linesSeen = 0;
  for (let c = from + 2 * dir; ; c += dir) {
    const inside = c >= 0 && c < across;
    let walls = 0;
    let inked = 0;
    let mass = 0;
    if (inside) {
      for (let a = g.a0; a <= g.a1; a += step) {
        const i = at(a, c);
        walls += wall[i]!;
        if (lines[i]) {
          inked++;
          mass += geo.ink[i]!;
        }
      }
      if (walls >= 0.3 * samples) return 'blocked';
    }
    const dist = Math.abs(c - from);
    if (inside && inked >= 0.5 * samples) {
      if (runStart < 0) runStart = dist;
      runMass += mass / samples;
      continue;
    }
    if (runStart >= 0) {
      // A line just ended: a pane or thin wall if it's heavy or pairs with the one before.
      if (runMass >= PANE * geo.single || runStart - lastEnd - 1 <= spacing) {
        const cc = from + dir * Math.round((runStart + dist) / 2);
        const through = seeThrough.find(
          (f) =>
            f.axis === g.axis &&
            cc >= f.c0 - spacing &&
            cc <= f.c1 + spacing &&
            Math.min(f.a1, g.a1) - Math.max(f.a0, g.a0) >= 0.5 * span,
        );
        if (!through || linesSeen > 1 || runStart > MAX_BALCONY_DEPTH * t) return 'blocked';
        seeThrough = seeThrough.filter((f) => f !== through);
        c = (dir < 0 ? through.c0 : through.c1) + dir;
        lastEnd = -Infinity;
        linesSeen = 0;
      } else {
        linesSeen++;
        lastEnd = dist - 1;
      }
      runStart = -1;
      runMass = 0;
    }
    if (!inside) return 'open';
  }
}
