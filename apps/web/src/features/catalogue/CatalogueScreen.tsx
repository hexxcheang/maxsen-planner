import { useState } from 'react';
import { ChevronRight, Eye, EyeOff, Lock, Package, PencilLine, Plus } from 'lucide-react';
import {
  CATEGORIES,
  resolveCategoryStyle,
  type CategoryId,
  type Product,
  type Variant,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Badge, Button, EmptyState, IconButton, PageHeader } from '@/components/ui';
import { Page } from '@/components/Page';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { fileUrl } from '@/lib/files';
import { useActions, useCatalogue, useSettings } from '@/lib/data/hooks';
import { useAdmin } from '@/app/auth/auth-context';
import { useAdminAction } from '@/app/auth/useAdminAction';
import { ProductEditorDialog } from './ProductEditorDialog';
import { VariantEditorDialog } from './VariantEditorDialog';

type Editing =
  | { kind: 'product'; product: Product | null }
  | { kind: 'variant'; product: Product; variant: Variant | null }
  | null;

export function CatalogueScreen() {
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const actions = useActions();
  const admin = useAdmin();
  const asAdmin = useAdminAction();
  const [categoryId, setCategoryId] = useState<CategoryId>('smart-switches');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing>(null);
  const category = CATEGORIES.find((c) => c.id === categoryId)!;

  const products = catalogue.products
    .filter((p) => p.categoryId === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const variantsOf = (p: Product) =>
    catalogue.variants
      .filter((v) => v.productId === p.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const count = (id: CategoryId) => catalogue.products.filter((p) => p.categoryId === id).length;
  const empty = catalogue.products.length === 0;

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const addProduct = () =>
    asAdmin('add a product', () => setEditing({ kind: 'product', product: null }));

  return (
    <Page wide>
      <PageHeader
        title="Catalogue"
        description="Categories, products and variants offered in the planner library. Projects keep the names and descriptions they were planned with."
        actions={
          admin.unlocked ? (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={addProduct}>
              Add product
            </Button>
          ) : (
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-meta text-ink-2">
                <Lock aria-hidden className="size-3.5" />
                Unlock admin to edit
              </span>
              <Button onClick={() => void admin.requireAdmin('edit the catalogue')}>
                Unlock admin
              </Button>
            </span>
          )
        }
      />
      {empty ? (
        <EmptyState
          icon={<Package />}
          title="The catalogue is empty"
          body="Add the products and variants planners can place on plans."
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={addProduct}>
              Add product
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-8 max-[1180px]:grid-cols-[220px_minmax(0,1fr)] max-[1180px]:gap-5">
          <nav aria-label="Catalogue categories">
            <ul aria-label="Categories">
              {CATEGORIES.map((c, i) => (
                <li key={c.id}>
                  {(i === 0 || CATEGORIES[i - 1]?.planType !== c.planType) && (
                    <p
                      className={cn(
                        'mb-1 border-b border-rule pb-1 text-meta font-semibold text-ink-2',
                        i > 0 && 'mt-5',
                      )}
                    >
                      {c.planType === 'smart-home' ? 'Smart Home' : 'Lighting'}
                    </p>
                  )}
                  <button
                    type="button"
                    aria-current={c.id === categoryId || undefined}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      'relative flex h-9 w-full items-center gap-2 border-b border-rule px-2 text-left text-control',
                      c.id === categoryId
                        ? 'bg-brass-tint font-medium text-ink before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brass'
                        : 'text-ink-2 hover:bg-surface hover:text-ink',
                    )}
                  >
                    <CategoryGlyph
                      categoryId={c.id}
                      style={resolveCategoryStyle(c.id, settings)}
                      size={14}
                      showBadge={false}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="tnum text-meta text-ink-3">{count(c.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <section aria-label={category.name}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-section text-ink">{category.name}</h2>
            </div>
            {products.length === 0 ? (
              <p className="border-t border-rule py-8 text-control text-ink-2">
                No products in this category yet.
              </p>
            ) : (
              <ul className="border-t border-rule">
                {products.map((p) => {
                  const open = expanded.has(p.id);
                  const vs = variantsOf(p);
                  return (
                    <li key={p.id} className="border-b border-rule">
                      <div className="flex items-center gap-2 py-2">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} variants of ${p.name}`}
                          onClick={() => toggle(p.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <ChevronRight
                            aria-hidden
                            className={cn(
                              'size-3.5 shrink-0 text-ink-3 transition-transform',
                              open && 'rotate-90',
                            )}
                          />
                          <span className="truncate text-body font-semibold text-ink">
                            {p.name}
                          </span>
                          <span className="tnum text-meta text-ink-3">
                            {vs.length} {vs.length === 1 ? 'variant' : 'variants'}
                          </span>
                          {p.hidden && <Badge>Hidden</Badge>}
                          {p.system && <Badge tone="brass">Auto-added to totals</Badge>}
                        </button>
                        <IconButton
                          size="sm"
                          label={`Edit ${p.name}`}
                          icon={<PencilLine />}
                          onClick={() =>
                            asAdmin('edit the catalogue', () =>
                              setEditing({ kind: 'product', product: p }),
                            )
                          }
                        />
                        {!p.system && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Plus className="size-3.5" />}
                            onClick={() =>
                              asAdmin('add a variant', () =>
                                setEditing({ kind: 'variant', product: p, variant: null }),
                              )
                            }
                          >
                            Add variant
                          </Button>
                        )}
                      </div>
                      {open && (
                        <ul className="pb-2 pl-6">
                          {vs.map((v) => (
                            <li
                              key={v.id}
                              className={cn(
                                'grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-t border-rule py-2',
                                v.hidden && 'opacity-60',
                              )}
                            >
                              <span className="flex size-12 items-center justify-center overflow-hidden rounded-chip border border-rule bg-surface">
                                {v.imageFileId ? (
                                  <img
                                    src={fileUrl(v.imageFileId)}
                                    alt=""
                                    className="size-full object-contain"
                                  />
                                ) : (
                                  <Package aria-hidden className="size-4 text-ink-3" />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 text-control font-medium text-ink">
                                  {v.name}
                                  {v.hidden && <Badge>Hidden</Badge>}
                                  <span className="tnum text-meta font-normal text-ink-3">
                                    {v.price != null
                                      ? `S$${formatMoney(v.price)}${categoryId === 'led-strips' ? '/m' : ''}`
                                      : 'No price'}
                                  </span>
                                </span>
                                <span className="line-clamp-2 max-w-[72ch] text-meta text-ink-2">
                                  {v.description}
                                </span>
                              </span>
                              <span className="flex items-center gap-1">
                                {!p.system && (
                                  <IconButton
                                    size="sm"
                                    label={`${v.hidden ? 'Unhide' : 'Hide'} ${p.name}, ${v.name}`}
                                    icon={v.hidden ? <Eye /> : <EyeOff />}
                                    onClick={() =>
                                      asAdmin('hide or unhide variants', () =>
                                        actions.updateVariant(v.id, { hidden: !v.hidden }),
                                      )
                                    }
                                  />
                                )}
                                <IconButton
                                  size="sm"
                                  label={`Edit ${p.name}, ${v.name}`}
                                  icon={<PencilLine />}
                                  onClick={() =>
                                    asAdmin('edit the catalogue', () =>
                                      setEditing({ kind: 'variant', product: p, variant: v }),
                                    )
                                  }
                                />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
      <ProductEditorDialog
        open={editing?.kind === 'product'}
        product={editing?.kind === 'product' ? editing.product : null}
        categoryName={category.name}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(input) => {
          if (editing?.kind === 'product' && editing.product)
            actions.updateProduct(editing.product.id, input);
          else {
            const id = actions.addProduct(categoryId, input.name);
            if (input.hidden) actions.updateProduct(id, { hidden: true });
            setExpanded((s) => new Set(s).add(id));
          }
          setEditing(null);
        }}
      />
      <VariantEditorDialog
        open={editing?.kind === 'variant'}
        variant={editing?.kind === 'variant' ? editing.variant : null}
        productName={editing?.kind === 'variant' ? editing.product.name : ''}
        perMetre={categoryId === 'led-strips'}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(input) => {
          if (editing?.kind !== 'variant') return;
          const { imageFileId, ...fields } = input;
          if (editing.variant) {
            actions.updateVariant(editing.variant.id, fields);
            actions.setVariantImage(editing.variant.id, imageFileId);
          } else {
            const id = actions.addVariant(editing.product.id, fields);
            actions.updateVariant(id, { hidden: fields.hidden, price: fields.price });
            actions.setVariantImage(id, imageFileId);
            setExpanded((s) => new Set(s).add(editing.product.id));
          }
          setEditing(null);
        }}
      />
    </Page>
  );
}
