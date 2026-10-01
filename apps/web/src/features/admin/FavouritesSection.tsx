import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react';
import { categoryById, resolveCategoryStyle } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Button, IconButton, Input } from '@/components/ui';
import { useActions, useCatalogue, useSettings } from '@/lib/data/hooks';

export function FavouritesSection() {
  const { data: settings } = useSettings();
  const { data: catalogue } = useCatalogue();
  const actions = useActions();
  const [search, setSearch] = useState('');
  const productById = new Map(catalogue.products.map((p) => [p.id, p]));
  const variantById = new Map(catalogue.variants.map((v) => [v.id, v]));
  const ids = settings.favouriteVariantIds;
  const setIds = (next: string[]) =>
    actions.updateSettings((s) => {
      s.favouriteVariantIds = next;
    });

  const offered = [
    ...catalogue.visibleVariantsFor('smart-home'),
    ...catalogue.visibleVariantsFor('lighting'),
  ];
  const q = search.trim().toLowerCase();
  const results = q
    ? offered
        .filter((v) => !ids.includes(v.id))
        .filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (productById.get(v.productId)?.name.toLowerCase().includes(q) ?? false),
        )
        .slice(0, 8)
    : [];

  const label = (variantId: string) => {
    const v = variantById.get(variantId);
    const p = v ? productById.get(v.productId) : undefined;
    return { v, p, text: `${p?.name ?? 'Unknown'}, ${v?.name ?? ''}` };
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...ids];
    const j = i + dir;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setIds(next);
  };

  return (
    <div className="grid max-w-[960px] grid-cols-2 gap-10 max-[1180px]:grid-cols-1">
      <section aria-label="Shared favourites">
        <h3 className="text-control font-semibold text-ink">Shared favourites</h3>
        <p className="mt-1 mb-3 text-meta text-ink-2">
          Shown at the top of every planner’s library, in this order, on the matching plan type.
        </p>
        {ids.length === 0 ? (
          <p className="border-t border-rule py-6 text-control text-ink-2">
            No favourites yet. Find a variant to add one.
          </p>
        ) : (
          <ol className="border-t border-rule">
            {ids.map((id, i) => {
              const { p, text } = label(id);
              return (
                <li key={id} className="flex items-center gap-3 border-b border-rule py-2">
                  {p && (
                    <CategoryGlyph
                      categoryId={p.categoryId}
                      style={resolveCategoryStyle(p.categoryId, settings)}
                      size={22}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-control text-ink">{text}</span>
                    {p && (
                      <span className="block text-meta text-ink-3">
                        {categoryById(p.categoryId).name}
                      </span>
                    )}
                  </span>
                  <IconButton
                    size="sm"
                    label={`Move ${text} up`}
                    icon={<ArrowUp />}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="disabled:text-ink-3"
                  />
                  <IconButton
                    size="sm"
                    label={`Move ${text} down`}
                    icon={<ArrowDown />}
                    disabled={i === ids.length - 1}
                    onClick={() => move(i, 1)}
                    className="disabled:text-ink-3"
                  />
                  <IconButton
                    size="sm"
                    label={`Remove ${text}`}
                    icon={<X />}
                    onClick={() => setIds(ids.filter((x) => x !== id))}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section aria-label="Add a favourite">
        <h3 className="text-control font-semibold text-ink">Add a favourite</h3>
        <p className="mt-1 mb-3 text-meta text-ink-2">Hidden variants can’t be favourites.</p>
        <Input
          type="search"
          aria-label="Find a variant to add"
          leading={<Search />}
          placeholder="Search products and variants"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {q && (
          <ul className="mt-2 border-t border-rule">
            {results.length === 0 && (
              <li className="py-4 text-control text-ink-2">No variants match “{search.trim()}”</li>
            )}
            {results.map((v) => {
              const p = productById.get(v.productId);
              const text = `${p?.name ?? ''}, ${v.name}`;
              return (
                <li key={v.id} className="flex items-center gap-3 border-b border-rule py-2">
                  {p && (
                    <CategoryGlyph
                      categoryId={p.categoryId}
                      style={resolveCategoryStyle(p.categoryId, settings)}
                      size={22}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-control text-ink">{text}</span>
                  <Button
                    size="sm"
                    aria-label={`Add ${text}`}
                    icon={<Plus className="size-3.5" />}
                    onClick={() => setIds([...ids, v.id])}
                  >
                    Add
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
