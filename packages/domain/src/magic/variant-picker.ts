import type { CategoryId } from '../categories.ts';
import type { Product, Variant } from '../types.ts';
import type { VariantHint, VariantPick } from './magic-plan.ts';

interface Catalogue {
  products: Product[];
  variants: Variant[];
  favouriteVariantIds: string[];
}

const ROLE_PATTERNS: Record<NonNullable<VariantHint['role']>, RegExp> = {
  router: /router/i,
  mesh: /mesh|node|extender/i,
  'door-sensor': /door|window|contact/i,
  'motion-sensor': /motion|presence|occupancy/i,
  'indoor-camera': /indoor/i,
};

const gangsOf = (v: Variant) => Number(/(\d)\s*-?\s*gang/i.exec(v.name)?.[1] ?? NaN);

/**
 * Picks the catalogue variant Magic Plan should place for a category: favourites first, then the
 * catalogue order; switches stay within one range and match the gang count; hidden and system
 * variants are never used.
 */
export function createVariantPicker({
  products,
  variants,
  favouriteVariantIds,
}: Catalogue): VariantPick {
  const productById = new Map(products.map((p) => [p.id, p]));
  const fav = (id: string) => {
    const i = favouriteVariantIds.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  const usable = (categoryId: CategoryId) =>
    variants
      .filter((v) => {
        const p = productById.get(v.productId);
        return p && p.categoryId === categoryId && !p.hidden && !p.system && !v.hidden;
      })
      .sort((a, b) => {
        const pa = productById.get(a.productId)!;
        const pb = productById.get(b.productId)!;
        return fav(a.id) - fav(b.id) || pa.sortOrder - pb.sortOrder || a.sortOrder - b.sortOrder;
      });
  const label = (v: Variant) => `${productById.get(v.productId)?.name ?? ''} ${v.name}`;

  return (categoryId, hint) => {
    const list = usable(categoryId);
    if (list.length === 0) return null;

    if (categoryId === 'smart-switches' && hint?.gangs) {
      // Stay in the range of the first (favourite) switch so a home gets matching plates.
      const range = list.filter((v) => v.productId === list[0]!.productId);
      const exact =
        range.find((v) => gangsOf(v) === hint.gangs) ?? list.find((v) => gangsOf(v) === hint.gangs);
      if (exact) return exact.id;
      const bigger = range
        .filter((v) => gangsOf(v) > hint.gangs!)
        .sort((a, b) => gangsOf(a) - gangsOf(b))[0];
      return (bigger ?? list[0]!).id;
    }
    if (categoryId === 'curtains-blinds') {
      const want = hint?.wide ? /double/i : /single/i;
      return (list.find((v) => want.test(label(v))) ?? list[0]!).id;
    }
    if (hint?.role) {
      return (list.find((v) => ROLE_PATTERNS[hint.role!].test(label(v))) ?? list[0]!).id;
    }
    return list[0]!.id;
  };
}
