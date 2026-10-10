import type { CategoryStyle, CurtainPath, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Field, Select } from '@/components/ui';
import { usePlanner } from '../planner-context';
import { InspectorSection, LayerAndActions } from './parts';

interface Props {
  el: CurtainPath;
  snapshot: VariantSnapshot | undefined;
  style: CategoryStyle;
  variantOptions: { value: string; label: string }[];
}

export function CurtainInspector({ el, snapshot, style, variantOptions }: Props) {
  const { store, recordUse } = usePlanner();
  const update = store.getState().updateElement;
  return (
    <>
      <InspectorSection>
        <div className="flex items-center gap-3">
          <CategoryGlyph categoryId="curtains-blinds" style={style} size={32} />
          <div className="min-w-0">
            <p className="truncate text-control font-semibold text-ink">
              {snapshot?.productName ?? 'Unknown product'}
            </p>
            <p className="truncate text-meta text-ink-2">{snapshot?.variantName}, curtain track</p>
          </div>
        </div>
        <p className="text-meta text-ink-2">
          Drag its ends to fit the window, or press + to add a bend. Counts as one curtain.
        </p>
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
      </InspectorSection>
      <LayerAndActions offset={style.size} />
    </>
  );
}
