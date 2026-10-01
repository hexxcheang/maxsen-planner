import type { CategoryStyle, PointMarker, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Field, Input, NumberField, Select } from '@/components/ui';
import { EDIT_LATER, InspectorSection, LayerAndActions } from './parts';

interface Props {
  el: PointMarker;
  snapshot: VariantSnapshot | undefined;
  style: CategoryStyle;
  variantOptions: { value: string; label: string }[];
}

export function MarkerInspector({ el, snapshot, style, variantOptions }: Props) {
  return (
    <>
      <InspectorSection>
        <div className="flex items-center gap-3">
          <CategoryGlyph
            categoryId={snapshot?.categoryId ?? 'misc-smart-home'}
            style={style}
            size={32}
          />
          <div className="min-w-0">
            <p className="truncate text-control font-semibold text-ink">
              {snapshot?.productName ?? 'Unknown product'}
            </p>
            <p className="truncate text-meta text-ink-2">
              {snapshot?.variantName}, {style.name}
            </p>
          </div>
        </div>
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
        <Field label="Label" optional>
          <Input
            compact
            value={el.label}
            placeholder="e.g. Entrance"
            disabled
            readOnly
            title={EDIT_LATER}
          />
        </Field>
        <Field label="Rotation">
          <NumberField compact value={el.rotation} unit="°" disabled />
        </Field>
      </InspectorSection>
      <LayerAndActions />
    </>
  );
}
