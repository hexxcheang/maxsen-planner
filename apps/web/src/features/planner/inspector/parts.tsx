import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';
import { IconButton, Input, Textarea } from '@/components/ui';
import { usePlanner } from '../planner-context';

export function InspectorSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-rule px-4 py-3">
      {title && <h3 className="text-meta font-semibold text-ink-2">{title}</h3>}
      {children}
    </div>
  );
}

/** Layer order, duplicate and delete for the current selection. */
export function LayerAndActions({
  duplicate = true,
  offset,
}: {
  duplicate?: boolean;
  offset: number;
}) {
  const { store } = usePlanner();
  const s = store.getState();
  return (
    <InspectorSection title="Arrange">
      <div className="flex items-center gap-1">
        <IconButton
          size="sm"
          variant="secondary"
          label="Bring to front (Shift+])"
          icon={<ArrowUpToLine />}
          onClick={() => s.reorder('front')}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label="Bring forward (])"
          icon={<ChevronUp />}
          onClick={() => s.reorder('forward')}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label="Send backward ([)"
          icon={<ChevronDown />}
          onClick={() => s.reorder('backward')}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label="Send to back (Shift+[)"
          icon={<ArrowDownToLine />}
          onClick={() => s.reorder('back')}
        />
        <span className="ml-auto flex gap-1">
          {duplicate && (
            <IconButton
              size="sm"
              variant="secondary"
              label="Duplicate (Ctrl+D)"
              icon={<Copy />}
              onClick={() => s.duplicateSelection(offset)}
            />
          )}
          <IconButton
            size="sm"
            variant="secondary"
            label="Delete (Delete)"
            icon={<Trash2 />}
            onClick={() => s.deleteSelection()}
          />
        </span>
      </div>
    </InspectorSection>
  );
}

/** A text input that saves on blur or Enter, so typing makes one undo step, not one per key. */
export function CommitInput({
  value,
  onCommit,
  multiline,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  if (multiline) {
    return (
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
        }}
        {...rest}
      />
    );
  }
  return (
    <Input
      compact
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      {...rest}
    />
  );
}
