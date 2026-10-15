import { pathLength, samplePath } from './geometry/path.ts';
import type { LedStripPath, PlanScale } from './types.ts';

/** LED strip is estimated in half metres, rounded up, like an installer's take-off. */
const STEP_M = 0.5;

/** A run's length on the plan, in plan units, following its curve when it's drawn smooth. */
export function runLengthUnits(el: Pick<LedStripPath, 'points' | 'closed' | 'smooth'>): number {
  const pts = samplePath(el.points, { closed: el.closed, smooth: el.smooth });
  // A sampled closed curve already ends back near its start; its last gap closes the loop.
  return pathLength(pts, el.closed);
}

/** A run's length in metres from the plan's scale, rounded up to the next half metre. */
export function estimateLedMetres(
  el: Pick<LedStripPath, 'points' | 'closed' | 'smooth'>,
  scale: PlanScale | undefined,
): number | null {
  if (!scale || !(scale.unitsPerMetre > 0)) return null;
  const metres = runLengthUnits(el) / scale.unitsPerMetre;
  if (!(metres > 0)) return null;
  // A hair over a step (drawing wobble) doesn't add another half metre.
  return Math.max(STEP_M, Math.ceil(metres / STEP_M - 0.02) * STEP_M);
}

/**
 * The length a run counts as: what was typed, else the estimate from the plan's scale, else
 * none (the plan has no scale yet).
 */
export function ledMetres(
  el: LedStripPath,
  scale: PlanScale | undefined,
): { metres: number; estimated: boolean } | null {
  if (el.metres !== null) return { metres: el.metres, estimated: false };
  const estimate = estimateLedMetres(el, scale);
  return estimate === null ? null : { metres: estimate, estimated: true };
}

/** Plan units per metre, from a line drawn on the plan and its real length. */
export function scaleFromLine(lengthUnits: number, metres: number): number | null {
  return lengthUnits > 0 && metres > 0 ? lengthUnits / metres : null;
}
