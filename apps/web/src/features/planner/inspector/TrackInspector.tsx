import type { CategoryStyle, TrackPath, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Field, NumberField, Select, Switch } from '@/components/ui';
import { EDIT_LATER, InspectorSection, LayerAndActions } from './parts';

interface Props {
  el: TrackPath;
  snapshot: VariantSnapshot | undefined;
  style: CategoryStyle;
  variantOptions: { value: string; label: string }[];
}

export function TrackInspector({ el, snapshot, style, variantOptions }: Props) {
  const magnetic = snapshot?.categoryId === 'magnetic-track-lights';
  return (
    <>
      <InspectorSection>
        <div className="flex items-center gap-3">
          <CategoryGlyph
            categoryId={snapshot?.categoryId ?? 'track-lights'}
            style={style}
            size={32}
          />
          <div className="min-w-0">
            <p className="truncate text-control font-semibold text-ink">
              {snapshot?.productName ?? 'Unknown product'}
            </p>
            <p className="truncate text-meta text-ink-2">
              {snapshot?.variantName}, {magnetic ? 'magnetic track' : 'track'}
            </p>
          </div>
        </div>
        <p className="text-meta text-ink-2">Adds one Track Driver to the totals.</p>
      </InspectorSection>
      <InspectorSection>
        <Field label="Variant">
          <Select
            compact
            value={el.variantId}
            options={variantOptions}
            disabled
            title={EDIT_LATER}
          />
        </Field>
        <Field label={magnetic ? 'Modules' : 'Heads'} hint="Spaced evenly along the track">
          <NumberField compact value={el.headCount} min={1} stepper disabled />
        </Field>
        <Switch checked={el.showLabel} label="Show track label" disabled />
      </InspectorSection>
      <LayerAndActions duplicate={false} />
    </>
  );
}
