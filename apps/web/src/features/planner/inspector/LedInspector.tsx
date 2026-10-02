import type { CategoryStyle, LedStripPath, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Badge, Field, NumberField, Select, Switch } from '@/components/ui';
import { usePlanner } from '../planner-context';
import { InspectorSection, LayerAndActions } from './parts';

interface Props {
  el: LedStripPath;
  snapshot: VariantSnapshot | undefined;
  style: CategoryStyle;
  variantOptions: { value: string; label: string }[];
}

export function LedInspector({ el, snapshot, style, variantOptions }: Props) {
  const { store, recordUse } = usePlanner();
  const update = store.getState().updateElement;
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
            onChange={(variantId) => {
              recordUse(variantId);
              update(el.id, { variantId });
            }}
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
          <NumberField
            compact
            value={el.metres}
            unit="m"
            precision={2}
            min={0}
            allowEmpty
            onChange={(metres) => update(el.id, { metres })}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{el.points.length} points</Badge>
        </div>
        <Switch
          checked={el.closed}
          onCheckedChange={(closed) => update(el.id, { closed })}
          label="Closed loop"
        />
        <Switch
          checked={el.smooth}
          onCheckedChange={(smooth) => update(el.id, { smooth })}
          label="Smooth curve"
        />
        <Switch
          checked={el.showLabel}
          onCheckedChange={(showLabel) => update(el.id, { showLabel })}
          label="Show length label"
        />
      </InspectorSection>
      <LayerAndActions offset={style.size} />
    </>
  );
}
