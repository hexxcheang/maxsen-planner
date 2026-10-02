import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { usePlanner } from '../planner-context';
import { InspectorSection } from './parts';

export function MultiInspector({ count }: { count: number }) {
  const { store } = usePlanner();
  return (
    <InspectorSection>
      <p className="text-control font-semibold text-ink">{count} items selected</p>
      <p className="text-meta text-ink-2">Drag any selected item to move them together.</p>
      <Button
        size="sm"
        variant="danger"
        icon={<Trash2 className="size-3.5" />}
        className="w-fit"
        onClick={() => store.getState().deleteSelection()}
      >
        Delete {count} items
      </Button>
    </InspectorSection>
  );
}
