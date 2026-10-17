/**
 * What goes into each export, as plain data. The PDF and Excel writers only lay this out, so the
 * rules (sections, ordering, drivers, exclusions, export quantities) are tested here.
 */
import {
  CATEGORIES,
  categoryById,
  type CategoryId,
  type FloorPlanExportSettings,
  type Level,
  type Plan,
  type PlanType,
  type ReviewLine,
  type VariantResolver,
} from '@maxsen/domain';
import { formatQuantity } from '@/lib/format';

const SECTION_TITLES: Record<PlanType, string> = {
  'smart-home': 'Smart Home Products',
  lighting: 'Lighting Products',
};

export interface QuantityRow {
  category: string;
  product: string;
  variant: string;
  quantity: number;
  unit: 'pcs' | 'm';
}

/** Excel rows: every line including drivers, at its export quantity, grouped by plan type. */
export function quantitySections(lines: ReviewLine[]): { title: string; rows: QuantityRow[] }[] {
  return (['smart-home', 'lighting'] as const)
    .map((pt) => ({
      title: SECTION_TITLES[pt],
      rows: lines
        .filter((l) => categoryById(l.categoryId).planType === pt)
        .map((l) => ({
          category: categoryById(l.categoryId).name,
          product: l.productName,
          variant: l.variantName,
          quantity: l.exportQuantity,
          unit: l.unit,
        })),
    }))
    .filter((s) => s.rows.length > 0);
}

export interface ProductItem {
  variantId: string;
  productName: string;
  variantName: string;
  description: string;
  imageFileId: string | null;
  quantity: string;
}

/** Customer-facing product list: no drivers, no excluded categories, fixed category order. */
export function productSections(
  lines: ReviewLine[],
  excluded: CategoryId[],
  resolve: VariantResolver,
): {
  title: string;
  categories: { categoryId: CategoryId; name: string; items: ProductItem[] }[];
}[] {
  return (['smart-home', 'lighting'] as const)
    .map((pt) => ({
      title: SECTION_TITLES[pt],
      categories: CATEGORIES.filter((c) => c.planType === pt && !excluded.includes(c.id))
        .map((c) => ({
          categoryId: c.id,
          name: c.name,
          items: lines
            .filter((l) => l.categoryId === c.id && !l.autoAdded && l.exportQuantity > 0)
            .map((l) => {
              const snap = resolve(l.variantId);
              return {
                variantId: l.variantId,
                productName: l.productName,
                variantName: l.variantName,
                description: snap?.description ?? '',
                imageFileId: snap?.imageFileId ?? null,
                quantity: formatQuantity(l.exportQuantity, l.unit),
              };
            }),
        }))
        .filter((c) => c.items.length > 0),
    }))
    .filter((s) => s.categories.length > 0);
}

/** Plan pages for the marked floor plan, in level order, honouring the per-level selection. */
export function floorPlanPages(levels: Level[], plans: Plan[], settings: FloorPlanExportSettings) {
  const ordered = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);
  return ordered.flatMap((level) => {
    const pick = settings.levels[level.id] ?? { smartHome: true, lighting: true };
    return (['smart-home', 'lighting'] as const).flatMap((type) => {
      const wanted = type === 'smart-home' ? pick.smartHome : pick.lighting;
      const plan = plans.find((p) => p.levelId === level.id && p.type === type);
      return wanted && plan ? [{ level, plan }] : [];
    });
  });
}
