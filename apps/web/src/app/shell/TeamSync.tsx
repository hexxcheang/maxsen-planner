import { useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Button, Dialog, Field, Input, useToast } from '@/components/ui';
import { useStoreContext } from '@/lib/data/store-context';
import { formatUpdated } from '@/lib/format';
import { resolveWorkspace, setTeamName, startTeamSync, useTeamSync } from '@/lib/shared/useShared';

/**
 * Runs team sync for the whole app (see `lib/shared/useShared.ts`), and asks what it needs to:
 * a name to sign saves with, and which catalogue to keep when this device's and the team's differ.
 * Warns when the server would lose the team's saves on its next update.
 */
export function TeamSync() {
  const { store } = useStoreContext();
  const sync = useTeamSync();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [hideWarning, setHideWarning] = useState(false);

  useEffect(() => {
    // Review modes (?sample=…) are throwaway and never shared.
    if (!new URLSearchParams(window.location.search).has('sample')) void startTeamSync(store);
  }, [store]);

  const choose = async (keep: 'theirs' | 'mine') => {
    setBusy(true);
    try {
      await resolveWorkspace(keep);
      toast({
        title:
          keep === 'theirs'
            ? 'Using the team’s catalogue and settings'
            : 'This device’s catalogue and settings are now the team’s',
      });
    } catch (e) {
      toast({
        title: 'That didn’t go through',
        body: e instanceof Error ? e.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };
  const w = sync.workspaceConflict;

  return (
    <>
      {sync.enabled && !sync.persistent && !hideWarning && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-warn bg-warn-tint px-4 py-2 text-control text-ink"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="flex-1">
            Team saves on this server will be lost at its next update: it has no disk to keep them.
            In Render, add a disk at <code>/var/data</code> and set <code>DATA_DIR</code> to{' '}
            <code>/var/data</code>, then redeploy.
          </p>
          <button type="button" aria-label="Hide for now" onClick={() => setHideWarning(true)}>
            <X className="size-4 text-ink-2" />
          </button>
        </div>
      )}

      <Dialog
        open={sync.needName}
        onOpenChange={() => undefined}
        width="sm"
        title="Your name"
        description="Projects are saved for the whole team as you work. Your name goes with each save, so others know who changed what. Asked once on this device."
        footer={
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => setTeamName(name.trim())}
          >
            Continue
          </Button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setTeamName(name.trim());
          }}
        >
          <Field label="Name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={w !== null}
        onOpenChange={() => undefined}
        width="sm"
        title={
          w?.first ? 'The team’s catalogue and settings' : 'Catalogue and settings changed twice'
        }
        description={
          w &&
          (w.first
            ? `This device’s catalogue, prices and settings differ from the team’s (last saved by ${w.meta.savedBy}, ${formatUpdated(w.meta.savedAt)}). Choose which everyone uses.`
            : `${w.meta.savedBy} changed the catalogue, prices or settings ${formatUpdated(w.meta.savedAt)}, while they were also changed on this device. Choose which everyone keeps.`)
        }
        footer={
          <>
            <Button disabled={busy} onClick={() => void choose('mine')}>
              Use this device’s
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void choose('theirs')}>
              Use the team’s
            </Button>
          </>
        }
      >
        <p className="text-control text-ink-2">
          {w?.first
            ? 'Usually the team’s: choose this device’s only if it has the catalogue and prices you keep up to date.'
            : '“Use the team’s” replaces the changes made here; “Use this device’s” replaces theirs.'}
        </p>
      </Dialog>
    </>
  );
}
