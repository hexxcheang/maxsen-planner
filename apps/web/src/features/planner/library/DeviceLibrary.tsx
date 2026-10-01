import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  categoriesForPlan,
  resolveCategoryStyle,
  type PlanType,
  type Product,
  type Variant,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Input } from '@/components/ui';
import { useCatalogue, useFavourites, useProject, useSettings } from '@/lib/data/hooks';
import { LibrarySection } from './LibrarySection';
import { VariantTile } from './VariantTile';

interface DeviceLibraryProps {
  projectId: string;
  planType: PlanType;
}

export function DeviceLibrary({ projectId, planType }: DeviceLibraryProps) {
  const [search, setSearch] = useState('');
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const { data: favourites } = useFavourites();
  const { data: project } = useProject(projectId);

  const visible = useMemo(() => catalogue.visibleVariantsFor(planType), [catalogue, planType]);
  const productById = useMemo(
    () => new Map(catalogue.products.map((p) => [p.id, p])),
    [catalogue.products],
  );
  const visibleIds = new Set(visible.map((v) => v.id));
  const styleFor = (p: Product) => resolveCategoryStyle(p.categoryId, settings);
  const sortVariants = (a: Variant, b: Variant) => a.sortOrder - b.sortOrder;

  const tiles = (variants: Variant[], productFirst = true) =>
    variants.flatMap((v) => {
      const p = productById.get(v.productId);
      return p
        ? [
            <VariantTile
              key={v.id}
              variant={v}
              product={p}
              style={styleFor(p)}
              productFirst={productFirst}
            />,
          ]
        : [];
    });

  const q = search.trim().toLowerCase();
  const results = q
    ? visible.filter((v) => {
        const p = productById.get(v.productId);
        return v.name.toLowerCase().includes(q) || (p?.name.toLowerCase().includes(q) ?? false);
      })
    : [];

  const favs = favourites.filter((v) => visibleIds.has(v.id));
  const recent = (project?.recentVariantIds ?? []).flatMap((id) =>
    visible.filter((v) => v.id === id),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-rule p-3">
        <Input
          compact
          type="search"
          aria-label="Search devices"
          leading={<Search />}
          placeholder="Search products and variants"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {q ? (
          results.length === 0 ? (
            <p className="px-4 py-6 text-control text-ink-2">No devices match “{search.trim()}”</p>
          ) : (
            <ul aria-label="Search results" className="p-1">
              {tiles(results)}
            </ul>
          )
        ) : (
          <>
            {favs.length > 0 && (
              <LibrarySection title="Favourites" count={favs.length} defaultOpen>
                <ul aria-label="Favourites">{tiles(favs)}</ul>
              </LibrarySection>
            )}
            {recent.length > 0 && (
              <LibrarySection title="Recently used" count={recent.length} defaultOpen>
                <ul aria-label="Recently used">{tiles(recent)}</ul>
              </LibrarySection>
            )}
            {categoriesForPlan(planType).map((c) => {
              const inCategory = visible.filter(
                (v) => productById.get(v.productId)?.categoryId === c.id,
              );
              const products = catalogue.products
                .filter(
                  (p) => p.categoryId === c.id && inCategory.some((v) => v.productId === p.id),
                )
                .sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <LibrarySection
                  key={c.id}
                  categoryId={c.id}
                  title={c.name}
                  count={inCategory.length}
                  icon={
                    <CategoryGlyph
                      categoryId={c.id}
                      style={resolveCategoryStyle(c.id, settings)}
                      size={18}
                      showBadge={false}
                    />
                  }
                >
                  {products.length === 0 ? (
                    <p className="px-3 py-2 text-meta text-ink-3">
                      No products in this category yet.
                    </p>
                  ) : (
                    products.map((p) => (
                      <div key={p.id} className="pt-1">
                        <p className="px-2 pt-1 pb-0.5 text-meta font-medium text-ink-2">
                          {p.name}
                        </p>
                        <ul aria-label={p.name}>
                          {tiles(
                            inCategory.filter((v) => v.productId === p.id).sort(sortVariants),
                            false,
                          )}
                        </ul>
                      </div>
                    ))
                  )}
                </LibrarySection>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
