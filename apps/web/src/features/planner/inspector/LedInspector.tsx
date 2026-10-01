import type { CategoryStyle, LedStripPath, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Badge, Field, NumberField, Select, Switch } from '@/components/ui';
import { EDIT_LATER, InspectorSection, LayerAndActions } from './parts';

interface Props {
  el: LedStripPath;
  snapshot: VariantSnapshot | undefined;
  style: CategoryStyle;
  variantOptions: { value: string; label: string }[];
}

export function LedInspector({ el, snapshot, style, variantOptions }: Props) {
  return (
    <>
      <InspectorSection>
        <div className="flex items-center gap-3">
          <CategoryGlyph categoryId="led-strips" style={style} size={32} />
          <div className="min-w-0">
            <p className="truncate text-control font-semibold text-ink">
              {snapshot?.productName ?? 'Unknown product'}
            </p>
            <p className="truncate text-meta text-ink-2">{snapshot?.variantName}, LED strip run</p>
          </div>
        </div>
        <p className="text-meta text-ink-2">Adds one Smart LED Driver to the totals.</p>
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
        <Field
          label="Length"
          hint={
            el.metres === null
              ? undefined
              : 'Typed in by the planner, never measured from the drawing'
          }
          error={el.metres === null ? 'Enter the length so totals are right' : undefined}
        >
          <NumberField compact value={el.metres} unit="m" precision={2} allowEmpty disabled />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{el.points.length} points</Badge>
          {el.closed && <Badge>Closed loop</Badge>}
          {el.smooth && <Badge>Smooth curve</Badge>}
        </div>
        <Switch checked={el.showLabel} label="Show length label" disabled />
      </InspectorSection>
      <LayerAndActions duplicate={false} />
    </>
  );
}
