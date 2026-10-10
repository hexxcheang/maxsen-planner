import { MousePointerClick } from 'lucide-react';
import type { PlanDocument, PlanType, Settings, VariantResolver } from '@maxsen/domain';
import { categoryById, resolveCategoryStyle } from '@maxsen/domain';
import { useCatalogue } from '@/lib/data/hooks';
import { LedInspector } from './LedInspector';
import { MarkerInspector } from './MarkerInspector';
import { MultiInspector } from './MultiInspector';
import { NoteInspector } from './NoteInspector';
import { CurtainInspector } from './CurtainInspector';
import { TrackInspector } from './TrackInspector';

interface InspectorProps {
  document: PlanDocument;
  selection: string[];
  resolve: VariantResolver;
  settings: Settings;
  planType: PlanType;
}

export function Inspector({ document, selection, resolve, settings, planType }: InspectorProps) {
  const { data: catalogue } = useCatalogue();
  if (selection.length > 1) return <MultiInspector count={selection.length} />;
  const el = document.elements.find((e) => e.id === selection[0]);
  if (!el) {
    return (
      <div className="flex items-start gap-3 px-4 py-4">
        <MousePointerClick aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-control text-ink-2">
          Select a device, path or note to see its details. Shift-click to select more than one.
        </p>
      </div>
    );
  }
  if (el.kind === 'note') return <NoteInspector el={el} />;

  const snapshot = resolve(el.variantId);
  const categoryId = snapshot?.categoryId ?? 'misc-smart-home';
  const style = resolveCategoryStyle(categoryId, settings);
  // The variant picker lists the variants of the same kind on this plan type, plus the current one.
  const kind = categoryById(categoryId).kind;
  const productById = new Map(catalogue.products.map((p) => [p.id, p]));
  const options = catalogue
    .visibleVariantsFor(planType)
    .filter((v) => {
      const p = productById.get(v.productId);
      return p && categoryById(p.categoryId).kind === kind;
    })
    .map((v) => ({ value: v.id, label: `${productById.get(v.productId)?.name ?? ''}, ${v.name}` }));
  if (!options.some((o) => o.value === el.variantId)) {
    options.unshift({
      value: el.variantId,
      label: `${snapshot?.productName ?? 'Unknown'}, ${snapshot?.variantName ?? ''}`,
    });
  }

  if (el.kind === 'marker')
    return <MarkerInspector el={el} snapshot={snapshot} style={style} variantOptions={options} />;
  if (el.kind === 'led-strip')
    return <LedInspector el={el} snapshot={snapshot} style={style} variantOptions={options} />;
  if (el.kind === 'curtain')
    return <CurtainInspector el={el} snapshot={snapshot} style={style} variantOptions={options} />;
  return <TrackInspector el={el} snapshot={snapshot} style={style} variantOptions={options} />;
}
