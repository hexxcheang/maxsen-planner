import {
  SYSTEM_DRIVER_CATEGORY,
  SYSTEM_PRODUCT_IDS,
  SYSTEM_VARIANT_IDS,
  type CategoryId,
} from '../categories.ts';
import type { PlanDocument, VariantSnapshot } from '../types.ts';
import { compareLines } from './sort.ts';

export type LineKey = `variant:${string}`;

export const lineKey = (variantId: string): LineKey => `variant:${variantId}`;

export interface TotalLine {
  key: LineKey;
  variantId: string;
  categoryId: CategoryId;
  productName: string;
  variantName: string;
  unit: 'pcs' | 'm';
  calculated: number;
  /** True for the Smart LED Driver and Track Driver lines (product spec §9.3). */
  autoAdded: boolean;
  /** LED-strip runs of this variant whose metres have not been entered yet. */
  runsMissingMetres: number;
}

export type VariantResolver = (variantId: string) => VariantSnapshot | undefined;

const UNKNOWN_CATEGORY: CategoryId = 'misc-smart-home';

/** Names used for the auto-added drivers when the catalogue snapshot has not captured them. */
const SYSTEM_FALLBACKS: Record<
  string,
  Pick<VariantSnapshot, 'productId' | 'categoryId' | 'productName' | 'variantName'>
> = {
  [SYSTEM_VARIANT_IDS.smartLedDriver]: {
    productId: SYSTEM_PRODUCT_IDS.smartLedDriver,
    categoryId: SYSTEM_DRIVER_CATEGORY,
    productName: 'Smart LED Driver',
    variantName: 'Standard',
  },
  [SYSTEM_VARIANT_IDS.trackDriver]: {
    productId: SYSTEM_PRODUCT_IDS.trackDriver,
    categoryId: SYSTEM_DRIVER_CATEGORY,
    productName: 'Track Driver',
    variantName: 'Standard',
  },
};

interface Accumulator {
  unit: 'pcs' | 'm';
  total: number;
  missing: number;
  autoAdded: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Deterministic project-wide quantities (product spec §9–§10):
 * one unit per point marker and per curtain track; LED-strip metres summed per variant; track heads summed per
 * variant; one Smart LED Driver per LED run and one Track Driver per track. Consolidated across
 * every document (all levels, both plan types); editor visibility never affects the result.
 */
export function computeTotals(documents: PlanDocument[], resolve: VariantResolver): TotalLine[] {
  const acc = new Map<string, Accumulator>();
  const bump = (
    variantId: string,
    unit: 'pcs' | 'm',
    amount: number,
    autoAdded = false,
    missing = 0,
  ) => {
    const existing = acc.get(variantId);
    if (existing) {
      existing.total += amount;
      existing.missing += missing;
    } else {
      acc.set(variantId, { unit, total: amount, missing, autoAdded });
    }
  };

  for (const doc of documents) {
    for (const el of doc.elements) {
      switch (el.kind) {
        case 'marker':
          bump(el.variantId, 'pcs', 1);
          break;
        case 'led-strip':
          bump(el.variantId, 'm', el.metres ?? 0, false, el.metres === null ? 1 : 0);
          bump(SYSTEM_VARIANT_IDS.smartLedDriver, 'pcs', 1, true);
          break;
        case 'track':
          bump(el.variantId, 'pcs', el.headCount);
          bump(SYSTEM_VARIANT_IDS.trackDriver, 'pcs', 1, true);
          break;
        case 'curtain':
          bump(el.variantId, 'pcs', 1);
          break;
        case 'note':
          break;
      }
    }
  }

  const lines: TotalLine[] = [];
  for (const [variantId, a] of acc) {
    const snapshot = resolve(variantId);
    const fallback = SYSTEM_FALLBACKS[variantId];
    const names = snapshot ?? fallback;
    lines.push({
      key: lineKey(variantId),
      variantId,
      categoryId: names?.categoryId ?? UNKNOWN_CATEGORY,
      productName: names?.productName ?? 'Unknown product',
      variantName: names?.variantName ?? variantId,
      unit: a.unit,
      calculated: a.unit === 'm' ? round1(a.total) : a.total,
      autoAdded: a.autoAdded,
      runsMissingMetres: a.missing,
    });
  }
  return lines.sort(compareLines);
}
