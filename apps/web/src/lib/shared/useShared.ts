/**
 * Team sync: keeps this device and the team server in step without anyone pressing Save.
 *
 * - Projects changed here are saved for the team a short while after the editing stops (and at
 *   once when the app is put away), drawings only once.
 * - The team's list is fetched when the app opens, every minute while it's in view, and after each
 *   save. A project someone else saved since is brought in, unless it was changed here too: then
 *   it's a conflict, and the person chooses whose version to keep.
 * - The catalogue, prices, settings and templates are shared the same way.
 * - A shared project deleted here is taken off the team list; one deleted by someone else goes
 *   from here too, if it wasn't changed here.
 *
 * Sample projects stay on each device. Where the app runs without the server, none of this runs.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { smartLighting, type SampleStore } from '../data/sample-store';
import {
  acceptWorkspace,
  changedHere,
  deleteShared,
  listShared,
  loadShared,
  loadWorkspace,
  saveShared,
  savedByName,
  saveWorkspace,
  setSavedByName,
  SharedError,
  sharedStatus,
  syncedWorkspace,
  workspaceFingerprint,
  type SharedMeta,
  type Workspace,
  type WorkspaceMeta,
} from './api';
import { fingerprint } from './bundle';

export interface TeamSyncState {
  enabled: boolean;
  /** False when the server's saves would be lost on its next update (no disk on Render). */
  persistent: boolean;
  projects: SharedMeta[];
  workspace: WorkspaceMeta | null;
  saving: boolean;
  offline: boolean;
  lastSavedAt: string | null;
  /** Projects someone else saved while they were changed here too. */
  conflicts: Record<string, SharedMeta>;
  /** The team's catalogue and settings differ from this device's and both have changed. */
  workspaceConflict: { first: boolean; meta: WorkspaceMeta } | null;
  /** Saving waits for a name to sign the saves with. */
  needName: boolean;
}

/** How long after the last change a save goes out. */
export const SAVE_DELAY_MS = 15_000;

let state: TeamSyncState = {
  enabled: false,
  persistent: true,
  projects: [],
  workspace: null,
  saving: false,
  offline: false,
  lastSavedAt: null,
  conflicts: {},
  workspaceConflict: null,
  needName: false,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<TeamSyncState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

let store: SampleStore | null = null;
let timer: number | undefined;
let running: Promise<void> | null = null;
let again = false;
/** Shared projects on this device, to notice one being deleted here. */
let known = new Set<string>();
/** Deleted here because the team deleted them: not to be deleted on the server again. */
const removing = new Set<string>();

const isSample = (id: string) => id.startsWith('proj_sample');
const sharedIds = (s: SampleStore) =>
  new Set(s.getState().projects.flatMap((p) => (p.shared && !isSample(p.id) ? [p.id] : [])));

/** Starts syncing with the team server; does nothing where the app runs without one. */
export async function startTeamSync(s: SampleStore) {
  if (store) return;
  store = s;
  const status = await sharedStatus();
  set({ enabled: status.enabled, persistent: status.persistent });
  if (!status.enabled) return;
  known = sharedIds(s);
  s.subscribe(() => {
    // A shared project deleted here goes from the team list too.
    const now = sharedIds(s);
    for (const id of known)
      if (!now.has(id) && !removing.delete(id))
        void deleteShared(id)
          .then(() => refreshShared())
          .catch(() => undefined);
    known = now;
    schedule();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshShared();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    // Put away: save now. Back in view: catch up with the team.
    if (document.visibilityState === 'hidden') void saveNow();
    else void refreshShared();
  });
  window.addEventListener('pagehide', () => void saveNow());
  await refreshShared();
  schedule(1000);
}

function schedule(delay = SAVE_DELAY_MS) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void saveNow(), delay);
}

/** Saves what's changed here now, rather than after the pause. */
export function saveNow(): Promise<void> {
  if (!store || !state.enabled) return Promise.resolve();
  window.clearTimeout(timer);
  if (running) {
    again = true;
    return running;
  }
  running = flush().finally(() => {
    running = null;
    if (again) {
      again = false;
      void saveNow();
    }
  });
  return running;
}

async function flush() {
  const s = store!;
  const name = savedByName();
  const changed = s
    .getState()
    .projects.filter((p) => !isSample(p.id) && !state.conflicts[p.id] && changedHere(s, p.id))
    .map((p) => p.id);
  const synced = syncedWorkspace();
  const workspaceChanged =
    !state.workspaceConflict &&
    (synced
      ? workspaceFingerprint(s.getState()) !== synced.fingerprint &&
        (state.workspace?.version ?? 0) === synced.version
      : state.workspace === null);
  if (!changed.length && !workspaceChanged) return;
  if (!name) {
    set({ needName: true });
    return;
  }
  set({ saving: true });
  try {
    for (const id of changed) {
      try {
        await saveShared(s, id, name);
      } catch (e) {
        if (e instanceof SharedError && e.conflict && 'id' in e.conflict)
          set({ conflicts: { ...state.conflicts, [id]: e.conflict } });
        else throw e;
      }
    }
    if (workspaceChanged) {
      try {
        await saveWorkspace(s, name);
      } catch (e) {
        if (e instanceof SharedError && e.conflict && !('id' in e.conflict))
          set({ workspaceConflict: { first: false, meta: e.conflict } });
        else throw e;
      }
    }
    set({ offline: false, lastSavedAt: new Date().toISOString() });
  } catch (e) {
    // Offline or the server busy: tried again on the next change, or in a minute.
    set({ offline: e instanceof SharedError && e.offline });
    schedule(60_000);
  } finally {
    set({ saving: false });
  }
  await refreshShared();
}

/** Fetches the team's list now, and brings in what others have saved. */
export async function refreshShared(): Promise<void> {
  if (!store || !state.enabled) return;
  let list: Awaited<ReturnType<typeof listShared>>;
  try {
    list = await listShared();
  } catch (e) {
    set({ offline: e instanceof SharedError && e.offline });
    return;
  }
  set({ projects: list.projects, workspace: list.workspace, offline: false });
  await bringIn(list.projects, list.workspace);
}

async function bringIn(remote: SharedMeta[], workspace: WorkspaceMeta | null) {
  const s = store!;
  const local = new Map(s.getState().projects.map((p) => [p.id, p]));
  for (const r of remote) {
    const p = local.get(r.id);
    if (!p?.shared || r.version <= p.shared.version) continue;
    if (changedHere(s, r.id)) set({ conflicts: { ...state.conflicts, [r.id]: r } });
    else await loadShared(s, r.id).catch(() => undefined);
  }
  // Deleted by someone else, and not changed here since: it goes from here too.
  const onServer = new Set(remote.map((r) => r.id));
  for (const p of s.getState().projects)
    if (p.shared && !isSample(p.id) && !onServer.has(p.id) && !changedHere(s, p.id)) {
      removing.add(p.id);
      s.actions.deleteProject(p.id);
    }

  if (!workspace || state.workspaceConflict) return;
  const synced = syncedWorkspace();
  const mine = workspaceFingerprint(s.getState());
  if (!synced) {
    // This device hasn't joined the team's catalogue yet: the same is simply noted; different,
    // the person chooses which to keep, so a new tablet can't overwrite the team's.
    const theirs = await fetch('/api/shared/workspace', { credentials: 'same-origin' })
      .then((r) => r.json() as Promise<{ workspace: Workspace }>)
      .catch(() => null);
    if (!theirs) return;
    // Theirs as this device would show it, with the same wording updates.
    if (fingerprint(JSON.stringify(smartLighting(theirs.workspace))) === mine)
      acceptWorkspace(s, workspace.version);
    else set({ workspaceConflict: { first: true, meta: workspace } });
  } else if (workspace.version > synced.version) {
    if (mine === synced.fingerprint) await loadWorkspace(s).catch(() => undefined);
    else set({ workspaceConflict: { first: false, meta: workspace } });
  }
}

/** Settles a project's conflict: the team's version, or this device's over it. */
export async function resolveConflict(id: string, keep: 'theirs' | 'mine') {
  const s = store!;
  if (keep === 'theirs') await loadShared(s, id);
  else await saveShared(s, id, savedByName() || 'Someone', true);
  const { [id]: _done, ...rest } = state.conflicts;
  set({ conflicts: rest });
  await refreshShared();
}

/** Settles the catalogue and settings: the team's, or this device's for everyone. */
export async function resolveWorkspace(keep: 'theirs' | 'mine') {
  const s = store!;
  if (keep === 'theirs') await loadWorkspace(s);
  else await saveWorkspace(s, savedByName() || 'Someone', true);
  set({ workspaceConflict: null });
  await refreshShared();
}

/** Signs this device's saves, and saves what was waiting for it. */
export function setTeamName(name: string) {
  setSavedByName(name);
  set({ needName: false });
  void saveNow();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTeamSync(): TeamSyncState {
  return useSyncExternalStore(subscribe, () => state);
}

/** The team's projects, for the Projects page. */
export function useSharedList() {
  const s = useTeamSync();
  return { enabled: s.enabled, projects: s.projects };
}

/** Re-renders every so often, for "saved 3 minutes ago". */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}
