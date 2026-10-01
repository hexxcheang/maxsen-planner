import type { TextNote } from '@maxsen/domain';
import { ColorSwatch, Field, NumberField, Switch, Textarea } from '@/components/ui';
import { EDIT_LATER, InspectorSection, LayerAndActions } from './parts';

export function NoteInspector({ el }: { el: TextNote }) {
  return (
    <>
      <InspectorSection>
        <p className="text-control font-semibold text-ink">Text note</p>
        <Field label="Text">
          <Textarea value={el.text} rows={3} disabled readOnly title={EDIT_LATER} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size">
            <NumberField compact value={el.fontSize} disabled />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-control font-medium text-ink">Colours</span>
            <span className="flex h-[var(--control-h-compact)] items-center gap-2 text-meta text-ink-2">
              <ColorSwatch color={el.color} /> Text
              {el.highlight ? <ColorSwatch color={el.highlight} /> : null}
              {el.highlight ? 'Highlight' : 'No highlight'}
            </span>
          </div>
        </div>
        <Switch checked={el.bold} label="Bold" disabled />
      </InspectorSection>
      <LayerAndActions />
    </>
  );
}
