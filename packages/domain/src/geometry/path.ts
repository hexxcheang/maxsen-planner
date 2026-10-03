import type { Pt } from '../types.ts';
import { catmullRomToBezier, cubicPoint } from './catmull-rom.ts';
import { dist, fmt, lerp } from './points.ts';

export interface PathOptions {
  closed: boolean;
  smooth: boolean;
}

export interface PathPoint {
  point: Pt;
  /** Tangent direction in degrees (0 = +x, 90 = +y, screen coordinates). */
  angle: number;
}

const SMOOTH_SUBDIVISIONS = 16;

/** Consecutive segments of a polyline, including the closing segment when `closed`. */
function segments(points: Pt[], closed: boolean): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (let i = 0; i + 1 < points.length; i++) out.push([points[i] as Pt, points[i + 1] as Pt]);
  if (closed && points.length > 2) out.push([points[points.length - 1] as Pt, points[0] as Pt]);
  return out;
}

const angleOf = (a: Pt, b: Pt): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** Total length of a polyline (straight segments). */
export function pathLength(points: Pt[], closed: boolean): number {
  let total = 0;
  for (const [a, b] of segments(points, closed)) total += dist(a, b);
  return total;
}

/** Point and tangent at distance `d` along a polyline; `d` is clamped to [0, length]. */
export function pointAtLength(points: Pt[], closed: boolean, d: number): PathPoint {
  const segs = segments(points, closed);
  const first = points[0] ?? { x: 0, y: 0 };
  if (segs.length === 0) return { point: first, angle: 0 };
  const total = pathLength(points, closed);
  let remaining = Math.min(Math.max(d, 0), total);
  for (const [a, b] of segs) {
    const len = dist(a, b);
    if (remaining <= len || len === 0) {
      const t = len === 0 ? 0 : remaining / len;
      return { point: lerp(a, b, t), angle: angleOf(a, b) };
    }
    remaining -= len;
  }
  const [a, b] = segs[segs.length - 1] as [Pt, Pt];
  return { point: b, angle: angleOf(a, b) };
}

export function pathMidpoint(points: Pt[], closed: boolean): PathPoint {
  return pointAtLength(points, closed, pathLength(points, closed) / 2);
}

export function polylineToSvgPath(points: Pt[], closed: boolean): string {
  if (points.length === 0) return '';
  const parts = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`);
  if (closed && points.length > 2) parts.push('Z');
  return parts.join(' ');
}

/** Smooth curve (Catmull-Rom → cubic Béziers) through the points as an SVG path string. */
export function smoothToSvgPath(points: Pt[], closed: boolean): string {
  const start = points[0];
  if (!start) return '';
  if (points.length === 1) return `M${fmt(start.x)} ${fmt(start.y)}`;
  const parts = [`M${fmt(start.x)} ${fmt(start.y)}`];
  for (const s of catmullRomToBezier(points, closed)) {
    parts.push(
      `C${fmt(s.c1.x)} ${fmt(s.c1.y)} ${fmt(s.c2.x)} ${fmt(s.c2.y)} ${fmt(s.p.x)} ${fmt(s.p.y)}`,
    );
  }
  if (closed && points.length > 2) parts.push('Z');
  return parts.join(' ');
}

/**
 * Flattens a path into a polyline. Straight paths return their points unchanged; smooth paths are
 * subdivided per Bézier segment. For closed paths the result does not repeat the first point.
 */
export function samplePath(points: Pt[], opts: PathOptions, step = SMOOTH_SUBDIVISIONS): Pt[] {
  if (!opts.smooth || points.length < 2) return points;
  const out: Pt[] = [];
  let from = points[0] as Pt;
  for (const seg of catmullRomToBezier(points, opts.closed)) {
    for (let i = 0; i < step; i++) out.push(cubicPoint(from, seg, i / step));
    from = seg.p;
  }
  if (!opts.closed) out.push(from);
  return out;
}

/** Positions of `headCount` heads spread evenly along an open polyline (centred spacing). */
export function headPositions(points: Pt[], headCount: number): PathPoint[] {
  if (headCount <= 0) return [];
  const total = pathLength(points, false);
  const out: PathPoint[] = [];
  for (let i = 0; i < headCount; i++) {
    out.push(pointAtLength(points, false, (total * (i + 0.5)) / headCount));
  }
  return out;
}

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}

/** Shortest distance from `p` to the drawn path (used for hit-testing). */
export function distanceToPath(p: Pt, points: Pt[], opts: PathOptions): number {
  const poly = samplePath(points, opts);
  if (poly.length === 1) return dist(p, poly[0] as Pt);
  let best = Infinity;
  for (const [a, b] of segments(poly, opts.closed)) {
    const d = distanceToSegment(p, a, b);
    if (d < best) best = d;
  }
  return best;
}

/** `n` points evenly spaced on a circle, starting at the top and going clockwise on screen. */
export function circlePoints(center: Pt, radius: number, n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    out.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return out;
}
