import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { useActions } from '@/lib/data/hooks';
import { clearFiles } from '@/lib/storage/file-store';

/** This MVP keeps everything in the browser; these controls start over. */
export function DataSection() {
  const actions = useActions();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<'sample' | 'empty' | null>(null);

  return (
    <div className="max-w-[720px]">
      <h3 className="text-control font-semibold text-ink">Where your work is saved</h3>
      <p className="mt-1 text-body text-ink-2">
        Projects, catalogue changes, settings and uploaded drawings are saved in this browser on
        this device. Other devices and other browsers don’t see them yet; shared storage arrives
        with the server in a later phase.
      </p>
      <div className="mt-6 flex flex-col gap-4 border-t border-rule pt-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-control font-medium text-ink">Restore the sample data</p>
            <p className="text-meta text-ink-2">
              Replaces everything with the three sample projects and catalogue.
            </p>
          </div>
          <Button icon={<RotateCcw className="size-4" />} onClick={() => setConfirm('sample')}>
            Restore sample data
          </Button>
        </div>
        <div className="flex items-start justify-between gap-6 border-t border-rule pt-4">
          <div>
            <p className="text-control font-medium text-ink">Start with an empty workspace</p>
            <p className="text-meta text-ink-2">
              Removes every project, product, template and uploaded file.
            </p>
          </div>
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" />}
            onClick={() => setConfirm('empty')}
          >
            Erase everything
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'empty' ? 'Erase everything?' : 'Restore the sample data?'}
        body="All projects, plans, uploads and catalogue changes saved in this browser are permanently replaced. This can’t be undone."
        confirmLabel={confirm === 'empty' ? 'Erase everything' : 'Restore sample data'}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const kind = confirm ?? 'sample';
          setConfirm(null);
          void clearFiles().then(() => {
            actions.resetData(kind);
            toast({ title: kind === 'empty' ? 'Workspace erased' : 'Sample data restored' });
          });
        }}
      />
    </div>
  );
}
