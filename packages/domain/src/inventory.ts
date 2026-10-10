/**
 * Inventory as a ledger of movements: stock is never typed in directly, it's what the restocks,
 * take-outs, returns and corrections add up to, so every number can be traced.
 *
 * - restock: stock arriving (the inventory manager).
 * - checkout: an installer taking items out for a site; pending until the inventory manager
 *   checks it, when the counted quantities replace what was written down.
 * - return: unused items coming back from a site.
 * - adjust: a correction after a physical count (+ or −).
 */

export const MOVEMENT_KINDS = ['restock', 'checkout', 'return', 'adjust'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  restock: 'Restock',
  checkout: 'Taken out',
  return: 'Returned',
  adjust: 'Count correction',
};

export interface MovementLine {
  variantId: string;
  /** "Product, variant" as it was named then. */
  name: string;
  /** How many: positive, except a count correction, which can be negative. */
  qty: number;
}

export interface Movement {
  id: string;
  kind: MovementKind;
  at: string;
  by: string;
  lines: MovementLine[];
  /** Where it's for: the site or project's name and address. */
  site?: string;
  projectId?: string;
  note?: string;
  /** A take-out once the inventory manager has checked it. */
  verified?: {
    by: string;
    at: string;
    /** The counted quantities, by variant. */
    counts: Record<string, number>;
    note?: string;
  };
}

export interface InventoryData {
  movements: Movement[];
  /** Low-stock level per variant: at or below it, the item is flagged. */
  minimums: Record<string, number>;
}

export interface StockLevel {
  variantId: string;
  name: string;
  inStock: number;
  /** Taken out for sites and not yet checked. */
  pending: number;
  low: boolean;
}

/** The quantity a movement changes stock by, per variant (a checked take-out by its count). */
export function movementEffect(m: Movement): Map<string, number> {
  const out = new Map<string, number>();
  const sign = m.kind === 'checkout' ? -1 : 1;
  for (const l of m.lines) {
    const qty =
      m.kind === 'checkout' && m.verified ? (m.verified.counts[l.variantId] ?? l.qty) : l.qty;
    out.set(l.variantId, (out.get(l.variantId) ?? 0) + sign * qty);
  }
  return out;
}

/** Stock of every item the ledger has seen, by name. */
export function stockLevels(data: InventoryData): StockLevel[] {
  const levels = new Map<string, StockLevel>();
  const at = (variantId: string, name: string) => {
    let l = levels.get(variantId);
    if (!l) {
      l = { variantId, name, inStock: 0, pending: 0, low: false };
      levels.set(variantId, l);
    }
    l.name = name || l.name;
    return l;
  };
  for (const m of [...data.movements].sort((a, b) => a.at.localeCompare(b.at))) {
    const names = new Map(m.lines.map((l) => [l.variantId, l.name]));
    for (const [variantId, delta] of movementEffect(m)) {
      const l = at(variantId, names.get(variantId) ?? '');
      l.inStock += delta;
      if (m.kind === 'checkout' && !m.verified) l.pending += -delta;
    }
  }
  for (const [variantId, min] of Object.entries(data.minimums))
    if (min > 0) at(variantId, levels.get(variantId)?.name ?? '');
  return [...levels.values()]
    .map((l) => ({
      ...l,
      low: l.inStock <= (data.minimums[l.variantId] ?? 0) && (data.minimums[l.variantId] ?? 0) > 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Take-outs, newest first, pending ones before checked ones. */
export function checkouts(data: InventoryData): Movement[] {
  return data.movements
    .filter((m) => m.kind === 'checkout')
    .sort((a, b) => Number(!!a.verified) - Number(!!b.verified) || b.at.localeCompare(a.at));
}

/** Where a checked take-out's count differs from what was written down: variant → [written, counted]. */
export function discrepancies(m: Movement): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  if (!m.verified) return out;
  for (const l of m.lines) {
    const counted = m.verified.counts[l.variantId] ?? l.qty;
    if (counted !== l.qty) out.set(l.variantId, [l.qty, counted]);
  }
  return out;
}
