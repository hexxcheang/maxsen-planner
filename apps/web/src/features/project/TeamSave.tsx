import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, CloudOff, CloudUpload, TriangleAlert } from 'lucide-react';
import type { Project } from '@maxsen/domain';
import { Button, Dialog, useToast } from '@/components/ui';
import { useStoreContext } from '@/lib/data/store-context';
import { formatUpdated } from '@/lib/format';
import { changedHere } from '@/lib/shared/api';
import { resolveConflict, saveNow, useNow, useTeamSync } from '@/lib/shared/useShared';

/**
 * The project's team copy at a glance, in the top bar. Saving is automatic; this says where it
 * stands, saves at once on a tap, and asks whose version to keep when someone else saved the
 * project while it was changed here too.
 */
export function TeamSave({ project }: { project: Project }) {
  const { store } = useStoreContext();
  const { toast } = useToast();
  const sync = useTeamSync();
  const now = useNow();
  const state = useSyncExternalStore(
    (l) => store.subscribe(l),
    () => store.getState(),
  );
  const [pending, setPending] = useState(() => changedHere(store, project.id));
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  // Fingerprinting a project reads all of it, so wait for a pause in the editing.
  useEffect(() => {
    const t = window.setTimeout(() => setPending(changedHere(store, project.id)), 400);
    return () => window.clearTimeout(t);
  }, [state, store, project.id, sync.lastSavedAt]);

  if (!sync.enabled || project.id.startsWith('proj_sample')) return null;
  const conflict = sync.conflicts[project.id];

  const keep = async (which: 'theirs' | 'mine') => {
    setBusy(true);
    try {
      await resolveConflict(project.id, which);
      toast({
        title:
          which === 'theirs' ? `Loaded ${conflict?.savedBy}’s version` : 'Your version is saved',
        body: which === 'theirs' ? undefined : 'Everyone now sees it.',
      });
      setChoosing(false);
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

  return (
    <>
      {conflict ? (
        <Button
          size="sm"
          variant="primary"
          icon={<TriangleAlert className="size-4" />}
          onClick={() => setChoosing(true)}
        >
          {conflict.savedBy} also changed this
        </Button>
      ) : sync.offline && pending ? (
        <span
          role="status"
          className="flex items-center gap-1.5 text-meta whitespace-nowrap text-ink-2"
        >
          <CloudOff aria-hidden className="size-4" />
          Will save when back online
        </span>
      ) : pending ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<CloudUpload className="size-4" />}
          loading={sync.saving}
          title="Saves for the team by itself in a few seconds; tap to save now"
          onClick={() => void saveNow()}
        >
          {sync.saving ? 'Saving…' : 'Save now'}
        </Button>
      ) : (
        <span
          role="status"
          className="flex items-center gap-1.5 text-meta whitespace-nowrap text-ink-2"
          title={
            project.shared
              ? `Saved by ${project.shared.savedBy}, ${formatUpdated(project.shared.savedAt, now)}`
              : undefined
          }
        >
          <Check aria-hidden className="size-4 text-ok" />
          Saved for team
        </span>
      )}

      <Dialog
        open={choosing && !!conflict}
        onOpenChange={setChoosing}
        width="sm"
        title="Two versions of this project"
        description={
          conflict &&
          `${conflict.savedBy} saved this project ${formatUpdated(conflict.savedAt, now)}, while it was also being changed on this device. Choose which version everyone keeps.`
        }
        footer={
          <>
            <Button disabled={busy} onClick={() => void keep('theirs')}>
              Use {conflict?.savedBy}’s
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void keep('mine')}>
              Keep mine
            </Button>
          </>
        }
      >
        <p className="text-control text-ink-2">
          “Use {conflict?.savedBy}’s” replaces the changes made here. “Keep mine” replaces theirs.
        </p>
      </Dialog>
    </>
  );
}
