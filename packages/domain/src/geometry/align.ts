/**
 * Smart alignment for lights being placed or dragged: snap into line with a nearby light across
 * or down the plan, and, where two or more lights already share that line, to the spot that keeps
 * their spacing even (the next step along the row, or halfway between two). Only within `tol`
 * of the pointer, so it helps without fighting the planner.
 */
import type { Pt } from '../types.ts';

/** A guide to draw while snapping: a line through aligned lights, or one of the equal gaps. */
export type AlignGuide = { kind: 'line'; from: Pt; to: Pt } | { kind: 'gap'; from: Pt; to: Pt };

export interface AlignResult {
  at: Pt;
  guides: AlignGuide[];
}

type Axis = 'x' | 'y';
const other = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');

/** Positions along `axis` that keep the spacing of the lights in a line even. */
function evenSpots(line: number[]): number[] {
  const spots: number[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const d = b - a;
    if (d <= 0) continue;
    // Halfway between two neighbours, and one step on past either end of an evenly spaced pair.
    spots.push((a + b) / 2);
    if (i === 1) spots.push(a - d);
    if (i === line.length - 1) spots.push(b + d);
  }
  return spots;
}

/**
 * Where `p` should land among `others`, snapping each axis independently: `tol` is how close (in
 * the same units) the pointer must be before it pulls. Only lights within `reach` of the pointer
 * count, so a light lines up with its neighbours, not with one far across the plan.
 */
export function alignPoint(p: Pt, all: Pt[], tol: number, reach: number = Infinity): AlignResult {
  const others = all.filter((o) => Math.hypot(o.x - p.x, o.y - p.y) <= reach);
  const at = { ...p };
  const snapped: Record<Axis, { value: number; how: 'line' | 'even' } | null> = {
    x: null,
    y: null,
  };

  for (const axis of ['x', 'y'] as const) {
    const cross = other(axis);
    let best: { value: number; dist: number; how: 'line' | 'even' } | null = null;
    // Line up with a light across from it (same x for a column, same y for a row).
    for (const o of others) {
      const d = Math.abs(o[axis] - p[axis]);
      if (d <= tol && (!best || d < best.dist)) best = { value: o[axis], dist: d, how: 'line' };
    }
    // Even spacing among the lights already in the line the pointer is on.
    const inLine = others
      .filter((o) => Math.abs(o[cross] - p[cross]) <= tol)
      .map((o) => o[axis])
      .sort((a, b) => a - b);
    if (inLine.length >= 2) {
      for (const s of evenSpots(inLine)) {
        const d = Math.abs(s - p[axis]);
        // Even spacing wins a tie: it's the more deliberate pattern.
        if (d <= tol && (!best || d <= best.dist + tol * 0.25))
          best = { value: s, dist: d, how: 'even' };
      }
    }
    if (best) {
      at[axis] = best.value;
      snapped[axis] = { value: best.value, how: best.how };
    }
  }

  const guides: AlignGuide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const cross = other(axis);
    // A line through every light sharing the snapped coordinate.
    const s = snapped[axis];
    if (s?.how === 'line') {
      const mates = others.filter((o) => Math.abs(o[axis] - s.value) < 1e-6);
      const span = [...mates.map((o) => o[cross]), at[cross]];
      const lo = Math.min(...span);
      const hi = Math.max(...span);
      guides.push(
        axis === 'x'
          ? { kind: 'line', from: { x: s.value, y: lo }, to: { x: s.value, y: hi } }
          : { kind: 'line', from: { x: lo, y: s.value }, to: { x: hi, y: s.value } },
      );
    }
    // The equal gaps along the line the light now sits in.
    const e = snapped[axis];
    if (e?.how === 'even') {
      const row = [...others.filter((o) => Math.abs(o[cross] - at[cross]) <= tol), at].sort(
        (a, b) => a[axis] - b[axis],
      );
      const i = row.indexOf(at);
      const step = Math.abs((row[i + 1] ?? row[i - 1]!)[axis] - row[i]![axis]);
      // Mark the gaps of that size on either side of the new light.
      for (let j = 1; j < row.length; j++) {
        const a = row[j - 1]!;
        const b = row[j]!;
        if (Math.abs(b[axis] - a[axis] - step) > Math.max(0.5, step * 0.02)) continue;
        guides.push(
          axis === 'x'
            ? { kind: 'gap', from: { x: a.x, y: at.y }, to: { x: b.x, y: at.y } }
            : { kind: 'gap', from: { x: at.x, y: a.y }, to: { x: at.x, y: b.y } },
        );
      }
      guides.push(
        axis === 'x'
          ? { kind: 'line', from: { x: row[0]!.x, y: at.y }, to: { x: row.at(-1)!.x, y: at.y } }
          : { kind: 'line', from: { x: at.x, y: row[0]!.y }, to: { x: at.x, y: row.at(-1)!.y } },
      );
    }
  }
  return { at, guides };
}
