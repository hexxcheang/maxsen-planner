import { Trash2 } from 'lucide-react';
import { Button, LATER_PHASE } from '@/components/ui';
import { InspectorSection } from './parts';

export function MultiInspector({ count }: { count: number }) {
  return (
    <InspectorSection>
      <p className="text-control font-semibold text-ink">{count} items selected</p>
      <p className="text-meta text-ink-2">Drag any selected item to move them together.</p>
      <Button
        size="sm"
        variant="danger"
        icon={<Trash2 className="size-3.5" />}
        disabledReason={LATER_PHASE}
        className="w-fit"
      >
        Delete {count} items
      </Button>
    </InspectorSection>
  );
}
