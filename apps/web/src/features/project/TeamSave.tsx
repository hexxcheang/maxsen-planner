import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CloudDownload, CloudUpload, Check } from 'lucide-react';
import type { Project } from '@maxsen/domain';
import { Button, ConfirmDialog, Dialog, Field, Input, useToast } from '@/components/ui';
import { useStoreContext } from '@/lib/data/store-context';
import { formatUpdated } from '@/lib/format';
import {
  changedHere,
  loadShared,
  saveShared,
  savedByName,
  setSavedByName,
  SharedError,
  type SharedMeta,
} from '@/lib/shared/api';
import { refreshShared, useNow, useSharedList } from '@/lib/shared/useShared';

/**
 * Saves the project for the whole team, and brings in a newer copy someone else saved. Work is
 * still kept on this device as it's made; this is what others see when they open the project.
 */
export function TeamSave({ project }: { project: Project }) {
  const { store } = useStoreContext();
  const { toast } = useToast();
  const { enabled, projects } = useSharedList();
  const now = useNow();
  const remote = projects.find((p) => p.id === project.id);
  const state = useSyncExternalStore(
    (l) => store.subscribe(l),
    () => store.getState(),
  );
  const [dirty, setDirty] = useState(() => changedHere(store, project.id));
  const [busy, setBusy] = useState<'save' | 'load' | null>(null);
  const [askName, setAskName] = useState(false);
  const [conflict, setConflict] = useState<SharedMeta | null>(null);
  const [offerLoad, setOfferLoad] = useState(false);
  const autoLoaded = useRef(0);

  // Fingerprinting a project reads all of it, so wait for a pause in the editing.
  useEffect(() => {
    const t = window.setTimeout(() => setDirty(changedHere(store, project.id)), 400);
    return () => window.clearTimeout(t);
  }, [state, store, project.id]);

  const local = project.shared?.version ?? 0;
  const newer = remote && remote.version > local ? remote : null;

  const load = async (quiet = false) => {
    setBusy('load');
    try {
      const meta = await loadShared(store, project.id);
      setDirty(false);
      toast({
        title: quiet ? `Updated to ${meta.savedBy}’s latest save` : 'Loaded the team’s latest',
        body: `Saved ${formatUpdated(meta.savedAt)}.`,
      });
    } catch (e) {
      toast({
        title: 'The latest couldn’t be loaded',
        body: e instanceof Error ? e.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(null);
      setOfferLoad(false);
    }
  };

  // Someone saved a newer copy and nothing has changed here: take it.
  useEffect(() => {
    if (!newer || dirty || busy || autoLoaded.current >= newer.version) return;
    autoLoaded.current = newer.version;
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newer, dirty, busy]);

  const save = async (name: string, force = false) => {
    setBusy('save');
    try {
      await saveShared(store, project.id, name, force);
      setDirty(false);
      await refreshShared();
      toast({ title: 'Saved for the team', body: 'Everyone now sees this version.' });
    } catch (e) {
      if (e instanceof SharedError && e.conflict) setConflict(e.conflict);
      else
        toast({
          title: 'Not saved for the team',
          body: e instanceof Error ? e.message : undefined,
          tone: 'danger',
        });
    } finally {
      setBusy(null);
    }
  };
  const startSave = () => {
    const name = savedByName();
    if (name) void save(name);
    else setAskName(true);
  };

  if (!enabled) return null;

  return (
    <>
      {newer && dirty ? (
        <Button
          size="sm"
          icon={<CloudDownload className="size-4" />}
          onClick={() => setOfferLoad(true)}
          loading={busy === 'load'}
          title={`${newer.savedBy} saved a newer version ${formatUpdated(newer.savedAt, now)}`}
        >
          Newer from {newer.savedBy}
        </Button>
      ) : null}
      {dirty || !project.shared ? (
        <Button
          size="sm"
          variant="primary"
          icon={<CloudUpload className="size-4" />}
          loading={busy === 'save'}
          onClick={startSave}
        >
          Save for team
        </Button>
      ) : (
        <span
          role="status"
          className="flex items-center gap-1.5 text-meta whitespace-nowrap text-ink-2"
          title={`Saved by ${project.shared.savedBy}, ${formatUpdated(project.shared.savedAt, now)}`}
        >
          <Check aria-hidden className="size-4 text-ok" />
          Team copy up to date
        </span>
      )}

      <NameDialog
        open={askName}
        onCancel={() => setAskName(false)}
        onDone={(name) => {
          setSavedByName(name);
          setAskName(false);
          void save(name);
        }}
      />
      <ConfirmDialog
        open={conflict !== null}
        title="Someone saved a newer version"
        body={
          conflict && (
            <>
              {conflict.savedBy} saved this project {formatUpdated(conflict.savedAt, now)}, after
              you last saved or loaded it. Saving now replaces their version with yours. To keep
              theirs instead, cancel and choose “Newer from {conflict.savedBy}”.
            </>
          )
        }
        confirmLabel="Replace with mine"
        destructive
        onCancel={() => {
          setConflict(null);
          void refreshShared();
        }}
        onConfirm={() => {
          setConflict(null);
          void save(savedByName() || 'Someone', true);
        }}
      />
      <ConfirmDialog
        open={offerLoad && newer !== null}
        title={`Load ${newer?.savedBy ?? 'the team'}’s version?`}
        body={
          newer && (
            <>
              {newer.savedBy} saved this project {formatUpdated(newer.savedAt, now)}. Loading it
              replaces the changes made on this device since your last save.
            </>
          )
        }
        confirmLabel="Load theirs"
        destructive
        onCancel={() => setOfferLoad(false)}
        onConfirm={() => void load()}
      />
    </>
  );
}

function NameDialog({
  open,
  onCancel,
  onDone,
}: {
  open: boolean;
  onCancel: () => void;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const ok = name.trim().length > 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      width="sm"
      title="Your name"
      description="Shown to the team with each save, so they know who changed the project. Asked once on this device."
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={() => onDone(name.trim())}>
            Save for team
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onDone(name.trim());
        }}
      >
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
