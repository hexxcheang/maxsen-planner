import type { TextNote } from '@maxsen/domain';
import { Field, NumberField, Switch } from '@/components/ui';
import { usePlanner } from '../planner-context';
import { CommitInput, InspectorSection, LayerAndActions } from './parts';

function ColourInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-meta text-ink-2">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-7 w-9 cursor-pointer rounded-chip border border-rule-2 bg-surface p-0.5"
      />
      {label}
    </label>
  );
}

export function NoteInspector({ el }: { el: TextNote }) {
  const { store } = usePlanner();
  const update = store.getState().updateElement;
  return (
    <>
      <InspectorSection>
        <p className="text-control font-semibold text-ink">Text note</p>
        <Field label="Text" hint="Saved when you click away">
          <CommitInput
            multiline
            value={el.text}
            onCommit={(text) => update(el.id, { text: text.trim() || 'Note' })}
          />
        </Field>
        <Field label="Size">
          <NumberField
            compact
            value={el.fontSize}
            min={4}
            max={120}
            onChange={(v) => v !== null && update(el.id, { fontSize: v })}
          />
        </Field>
        <Switch
          checked={el.bold}
          onCheckedChange={(bold) => update(el.id, { bold })}
          label="Bold"
        />
        <div className="flex flex-wrap items-center gap-4">
          <ColourInput
            value={el.color}
            label="Text colour"
            onChange={(color) => update(el.id, { color })}
          />
          {el.highlight && (
            <ColourInput
              value={el.highlight}
              label="Highlight"
              onChange={(highlight) => update(el.id, { highlight })}
            />
          )}
        </div>
        <Switch
          checked={el.highlight !== null}
          onCheckedChange={(on) => update(el.id, { highlight: on ? '#FBF3E3' : null })}
          label="Background highlight"
        />
      </InspectorSection>
      <LayerAndActions offset={el.fontSize} />
    </>
  );
}
