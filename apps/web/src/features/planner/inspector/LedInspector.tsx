import type { CategoryStyle, LedStripPath, VariantSnapshot } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Minus, Plus } from 'lucide-react';
import { Badge, Button, Field, NumberField, Select, Switch } from '@/components/ui';
import { MAX_PATH_POINTS } from '../canvas/PlanStage';
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
          label="Estimated length"
          optional
          hint="Not shown on the plan. Enter the final length in Review totals."
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
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{el.points.length} points</Badge>
          {!el.closed && (
            <>
              <Button
                size="sm"
                icon={<Plus className="size-4" />}
                disabledReason={
                  el.points.length >= MAX_PATH_POINTS
                    ? `At most ${MAX_PATH_POINTS} points`
                    : undefined
                }
                onClick={() => {
                  const last = el.points.at(-1)!;
                  const prev = el.points.at(-2) ?? { x: last.x - 1, y: last.y };
                  const d = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
                  const next = {
                    x: Math.round((last.x + ((last.x - prev.x) / d) * 50) * 10) / 10,
                    y: Math.round((last.y + ((last.y - prev.y) / d) * 50) * 10) / 10,
                  };
                  update(el.id, { points: [...el.points, next] });
                }}
              >
                Add a point
              </Button>
              <Button
                size="sm"
                icon={<Minus className="size-4" />}
                disabledReason={el.points.length <= 2 ? 'A run needs at least 2 points' : undefined}
                onClick={() => update(el.id, { points: el.points.slice(0, -1) })}
              >
                Remove last point
              </Button>
            </>
          )}
        </div>
        <p className="text-meta text-ink-2">
          Drag the round handles on the plan to bend or shorten the run; the + at its end adds a
          point you can drag to any angle.
        </p>
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
