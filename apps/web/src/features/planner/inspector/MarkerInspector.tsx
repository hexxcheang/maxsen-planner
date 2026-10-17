import { RotateCcw, RotateCw } from 'lucide-react';
import type { CategoryStyle, PointMarker, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Field, IconButton, NumberField, Select } from '@/components/ui';
import { usePlanner } from '../planner-context';
import { CommitInput, InspectorSection, LayerAndActions } from './parts';

interface Props {
  el: PointMarker;
  snapshot: VariantSnapshot | undefined;
  style: CategoryStyle;
  variantOptions: { value: string; label: string }[];
}

const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

export function MarkerInspector({ el, snapshot, style, variantOptions }: Props) {
  const { store, recordUse } = usePlanner();
  const update = store.getState().updateElement;
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
            onChange={(variantId) => {
              recordUse(variantId);
              update(el.id, { variantId });
            }}
          />
        </Field>
        <Field label="Label" optional>
          <CommitInput
            value={el.label}
            placeholder="e.g. Entrance"
            onCommit={(label) => update(el.id, { label: label.trim() })}
          />
        </Field>
        <Field label="Rotation">
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              variant="secondary"
              label="Rotate left 90°"
              icon={<RotateCcw />}
              onClick={() => update(el.id, { rotation: norm(el.rotation - 90) })}
            />
            <NumberField
              compact
              className="flex-1"
              value={el.rotation}
              unit="°"
              onChange={(v) => v !== null && update(el.id, { rotation: norm(v) })}
            />
            <IconButton
              size="sm"
              variant="secondary"
              label="Rotate right 90°"
              icon={<RotateCw />}
              onClick={() => update(el.id, { rotation: norm(el.rotation + 90) })}
            />
          </div>
        </Field>
      </InspectorSection>
      <LayerAndActions offset={style.size} />
    </>
  );
}
