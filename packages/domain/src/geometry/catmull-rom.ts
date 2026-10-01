import type { Pt } from '../types.ts';

export interface CubicSegment {
  c1: Pt;
  c2: Pt;
  /** End point of the segment. */
  p: Pt;
}

/**
 * Converts a Catmull-Rom spline through `points` into cubic Bézier segments.
 * `tension` 0.5 is the standard Catmull-Rom (control offset = chord / 6); smaller values pull the
 * curve tighter towards straight segments. Open paths duplicate their end points as phantom
 * neighbours; closed paths wrap around and return one segment per point.
 */
export function catmullRomToBezier(points: Pt[], closed: boolean, tension = 0.5): CubicSegment[] {
  const n = points.length;
  if (n < 2) return [];
  const k = tension / 3;
  const at = (i: number): Pt => {
    if (closed) return points[((i % n) + n) % n] as Pt;
    return points[Math.min(Math.max(i, 0), n - 1)] as Pt;
  };
  const count = closed ? n : n - 1;
  const segments: CubicSegment[] = [];
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    segments.push({
      c1: { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k },
      c2: { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k },
      p: p2,
    });
  }
  return segments;
}

/** Point on a cubic Bézier from `p0` with controls `c1`, `c2` to `p` at parameter t ∈ [0, 1]. */
export function cubicPoint(p0: Pt, s: CubicSegment, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * s.c1.x + c * s.c2.x + d * s.p.x,
    y: a * p0.y + b * s.c1.y + c * s.c2.y + d * s.p.y,
  };
}
