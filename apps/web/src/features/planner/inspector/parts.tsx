import type { ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';
import { IconButton, LATER_PHASE } from '@/components/ui';

export function InspectorSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-rule px-4 py-3">
      {title && <h3 className="text-meta font-semibold text-ink-2">{title}</h3>}
      {children}
    </div>
  );
}

export function LayerAndActions({ duplicate = true }: { duplicate?: boolean }) {
  return (
    <InspectorSection title="Arrange">
      <div className="flex items-center gap-1">
        <IconButton
          size="sm"
          variant="secondary"
          label="Bring to front"
          icon={<ArrowUpToLine />}
          disabledReason={LATER_PHASE}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label="Bring forward"
          icon={<ChevronUp />}
          disabledReason={LATER_PHASE}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label="Send backward"
          icon={<ChevronDown />}
          disabledReason={LATER_PHASE}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label="Send to back"
          icon={<ArrowDownToLine />}
          disabledReason={LATER_PHASE}
        />
        <span className="ml-auto flex gap-1">
          {duplicate && (
            <IconButton
              size="sm"
              variant="secondary"
              label="Duplicate"
              icon={<Copy />}
              disabledReason={LATER_PHASE}
            />
          )}
          <IconButton
            size="sm"
            variant="secondary"
            label="Delete"
            icon={<Trash2 />}
            disabledReason={LATER_PHASE}
          />
        </span>
      </div>
    </InspectorSection>
  );
}

/** Editing controls render with real values; Phase E/F make them editable. */
export const EDIT_LATER = `Editing: ${LATER_PHASE.toLowerCase()}`;
