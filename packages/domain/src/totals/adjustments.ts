import type { QuantityAdjustment } from '../types.ts';
import type { LineKey, TotalLine } from './compute-totals.ts';

export interface ReviewLine extends TotalLine {
  /** The quantity that goes into quantity-based exports. */
  exportQuantity: number;
  adjusted: boolean;
  /** The calculated quantity changed after the adjustment was saved (product spec §10.2). */
  warning: boolean;
  adjustment?: QuantityAdjustment;
}

export type Adjustments = Record<string, QuantityAdjustment>;

export function applyAdjustments(lines: TotalLine[], adjustments: Adjustments): ReviewLine[] {
  return lines.map((line) => {
    const adjustment = adjustments[line.key];
    if (!adjustment) return { ...line, exportQuantity: line.calculated, adjusted: false, warning: false };
    return {
      ...line,
      exportQuantity: adjustment.quantity,
      adjusted: true,
      warning: adjustment.calculatedAtAdjustment !== line.calculated,
      adjustment,
    };
  });
}

/**
 * Returns a new adjustments map with `key` set to `quantity`. Setting the quantity back to the
 * calculated value clears the adjustment (there is no separate reset action).
 */
export function setAdjustment(
  adjustments: Adjustments,
  key: LineKey,
  quantity: number,
  calculated: number,
  now: string,
): Adjustments {
  const next: Adjustments = { ...adjustments };
  if (quantity === calculated) {
    delete next[key];
    return next;
  }
  next[key] = { quantity, calculatedAtAdjustment: calculated, adjustedAt: now };
  return next;
}
