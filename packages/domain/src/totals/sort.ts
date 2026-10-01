import { categoryById, type CategoryId } from '../categories.ts';

export interface SortableLine {
  categoryId: CategoryId;
  productName: string;
  variantName: string;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Fixed category order → product name → variant name (numeric-aware, case-insensitive). */
export function compareLines(a: SortableLine, b: SortableLine): number {
  const byCategory = categoryById(a.categoryId).order - categoryById(b.categoryId).order;
  if (byCategory !== 0) return byCategory;
  const byProduct = collator.compare(a.productName, b.productName);
  if (byProduct !== 0) return byProduct;
  return collator.compare(a.variantName, b.variantName);
}
