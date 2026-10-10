import type { CategoryStyle, Product, Variant } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { cn } from '@/lib/cn';

/** Drag type carrying a variant id from the library onto the canvas. */
export const VARIANT_DRAG_TYPE = 'application/x-maxsen-variant';

export function VariantTile({
  variant,
  product,
  style,
  productFirst = false,
  armed = false,
  onArm,
}: {
  variant: Variant;
  product: Product;
  style: CategoryStyle;
  /** Lead with the product name in flat lists (favourites, recent, search) where there is no product heading. */
  productFirst?: boolean;
  armed?: boolean;
  onArm?: (variantId: string) => void;
}) {
  const [primary, secondary] = productFirst
    ? [product.name, variant.name]
    : [variant.name, product.name];
  const isPath = style.kind !== 'point';
  return (
    <li>
      <button
        type="button"
        draggable={!isPath}
        aria-pressed={armed}
        title={
          isPath
            ? 'Click, then click points on the plan. Double-click to finish.'
            : 'Click, then click the plan, or drag it onto the plan'
        }
        onClick={() => onArm?.(variant.id)}
        onDragStart={(e) => {
          e.dataTransfer.setData(VARIANT_DRAG_TYPE, variant.id);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left',
          armed ? 'bg-brass-tint shadow-[inset_0_0_0_1px_var(--brass)]' : 'hover:bg-paper',
          !isPath && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <CategoryGlyph categoryId={product.categoryId} style={style} size={22} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-control text-ink">{primary}</span>
          <span className="truncate text-caption text-ink-2">{secondary}</span>
        </span>
      </button>
    </li>
  );
}
