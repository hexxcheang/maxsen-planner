import type { Product, Variant } from '@maxsen/domain';
import type { CategoryStyle } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { LATER_PHASE } from '@/components/ui';

export function VariantTile({
  variant,
  product,
  style,
  productFirst = false,
}: {
  variant: Variant;
  product: Product;
  style: CategoryStyle;
  /** Lead with the product name in flat lists (favourites, recent, search) where there is no product heading. */
  productFirst?: boolean;
}) {
  const [primary, secondary] = productFirst
    ? [product.name, variant.name]
    : [variant.name, product.name];
  return (
    <li
      title={`Drag onto the plan: ${LATER_PHASE.toLowerCase()}`}
      className="flex cursor-not-allowed items-center gap-2.5 rounded-control px-2 py-1.5 hover:bg-paper"
    >
      <CategoryGlyph categoryId={product.categoryId} style={style} size={22} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-control text-ink">{primary}</span>
        <span className="truncate text-caption text-ink-2">{secondary}</span>
      </span>
    </li>
  );
}
