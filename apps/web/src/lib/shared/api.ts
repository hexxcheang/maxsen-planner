import type { SharedState } from '@maxsen/domain';
import type { SampleState, SampleStore } from '../data/sample-store';
import { putFileWithId, storedFileBlob, storedFileUrl } from '../storage/file-store';
import {
  bundleFileIds,
  bundleFingerprint,
  fileIdsIn,
  fingerprint,
  projectBundle,
  type ProjectBundle,
} from './bundle';

/** A project as the team server lists it. */
export interface SharedMeta {
  id: string;
  title: string;
  customerName: string;
  propertyAddress: string;
  status: string;
  version: number;
  savedAt: string;
  savedBy: string;
}

/** Who saved the team's catalogue, prices and settings last, and when. */
export interface WorkspaceMeta {
  version: number;
  savedAt: string;
  savedBy: string;
}

export class SharedError extends Error {
  constructor(
    message: string,
    readonly conflict?: SharedMeta | WorkspaceMeta,
    readonly offline = false,
  ) {
    super(message);
  }
}

const OFFLINE = 'The team server can’t be reached. Check the internet connection and try again.';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new SharedError(OFFLINE, undefined, true);
  }
  const body = (await res.json().catch(() => null)) as
    (T & { error?: string; message?: string; meta?: SharedMeta }) | null;
  if (res.status === 409 && body?.meta) throw new SharedError('conflict', body.meta);
  if (!res.ok || !body) throw new SharedError(body?.message ?? OFFLINE);
  return body;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * Whether this app is served with team saving (the online app, or `pnpm dev` with the server),
 * and whether its saves survive the server being updated.
 */
export async function sharedStatus(): Promise<{ enabled: boolean; persistent: boolean }> {
  try {
    const res = await fetch('/api/shared/status', { credentials: 'same-origin' });
    if (!res.ok) return { enabled: false, persistent: true };
    const body = (await res.json()) as { enabled?: boolean; persistent?: boolean };
    return { enabled: body.enabled === true, persistent: body.persistent !== false };
  } catch {
    return { enabled: false, persistent: true };
  }
}

/** The team's projects, and the version of the shared catalogue and settings. */
export const listShared = () =>
  call<{ projects: SharedMeta[]; workspace: WorkspaceMeta | null }>('/api/shared/projects');

/** Uploads the files some data mentions that the server doesn't have yet. */
async function uploadFiles(data: unknown) {
  const { missing } = await call<{ missing: string[] }>(
    '/api/shared/files/missing',
    json('POST', { ids: fileIdsIn(data) }),
  );
  for (const id of missing) {
    const blob = await storedFileBlob(id);
    if (!blob) continue; // Not on this device either (e.g. a sample picture).
    await call(`/api/shared/files/${id}`, {
      method: 'PUT',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    });
  }
}

/** Downloads the files some data mentions that this device doesn't have yet. */
async function downloadFiles(ids: string[]) {
  for (const id of ids) {
    if (storedFileUrl(id)) continue;
    try {
      const res = await fetch(`/api/shared/files/${id}`, { credentials: 'same-origin' });
      if (res.ok) await putFileWithId(id, await res.blob());
    } catch {
      throw new SharedError(OFFLINE, undefined, true);
    }
  }
}

/** Takes a project off the team's list (the server keeps it in its trash folder). */
export const deleteShared = (projectId: string) =>
  call<{ removed: boolean }>(`/api/shared/projects/${projectId}`, { method: 'DELETE' });

const NAME_KEY = 'maxsen.user.name';

/** The name saves are signed with on this device. */
export function savedByName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setSavedByName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // Asked again next time.
  }
}

const sharedState = (meta: SharedMeta, bundle: ProjectBundle): SharedState => ({
  version: meta.version,
  savedAt: meta.savedAt,
  savedBy: meta.savedBy,
  fingerprint: bundleFingerprint(bundle),
});

/**
 * Saves this device's copy of a project for the team: drawings the server lacks first, then the
 * project. Throws a SharedError with `conflict` set if someone has saved since this device last
 * did (or loaded theirs), unless `force`.
 */
export async function saveShared(
  store: SampleStore,
  projectId: string,
  savedBy: string,
  force = false,
): Promise<SharedMeta> {
  const bundle = projectBundle(store.getState(), projectId);
  if (!bundle) throw new SharedError('That project isn’t on this device.');
  await uploadFiles(bundle);
  const project = store.getState().projects.find((p) => p.id === projectId);
  const { meta } = await call<{ meta: SharedMeta }>(
    `/api/shared/projects/${projectId}`,
    json('PUT', { baseVersion: project?.shared?.version ?? 0, savedBy, force, bundle }),
  );
  store.actions.markShared(projectId, sharedState(meta, bundle));
  return meta;
}

/** Downloads the team's copy of a project, with its drawings, in place of this device's. */
export async function loadShared(store: SampleStore, projectId: string): Promise<SharedMeta> {
  const { meta, bundle } = await call<{ meta: SharedMeta; bundle: ProjectBundle }>(
    `/api/shared/projects/${projectId}`,
  );
  await downloadFiles(bundleFileIds(bundle));
  store.actions.importSharedProject(bundle, sharedState(meta, bundle));
  return meta;
}

/** Whether a project has changed on this device since it was last saved or loaded. */
export function changedHere(store: SampleStore, projectId: string): boolean {
  const state = store.getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project?.shared) return true;
  const bundle = projectBundle(state, projectId);
  return !bundle || bundleFingerprint(bundle) !== project.shared.fingerprint;
}

// --- the team's catalogue, prices, settings and templates ---------------------------------------

/** What's shared beyond projects: the catalogue, Admin's prices and settings, and templates. */
export type Workspace = Pick<SampleState, 'products' | 'variants' | 'settings' | 'templates'>;

export const workspaceOf = (s: SampleState): Workspace => ({
  products: s.products,
  variants: s.variants,
  settings: s.settings,
  templates: s.templates,
});

export const workspaceFingerprint = (s: SampleState) => fingerprint(JSON.stringify(workspaceOf(s)));

const WORKSPACE_KEY = 'maxsen.team.workspace';

/** The team workspace this device last saved or loaded: its version and fingerprint. */
export function syncedWorkspace(): { version: number; fingerprint: string } | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    return raw ? (JSON.parse(raw) as { version: number; fingerprint: string }) : null;
  } catch {
    return null;
  }
}

function markWorkspace(version: number, store: SampleStore) {
  try {
    window.localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({ version, fingerprint: workspaceFingerprint(store.getState()) }),
    );
  } catch {
    // Compared afresh next time.
  }
}

/** Saves this device's catalogue, prices, settings and templates for the team. */
export async function saveWorkspace(
  store: SampleStore,
  savedBy: string,
  force = false,
): Promise<WorkspaceMeta> {
  const workspace = workspaceOf(store.getState());
  await uploadFiles(workspace);
  const { meta } = await call<{ meta: WorkspaceMeta }>(
    '/api/shared/workspace',
    json('PUT', { baseVersion: syncedWorkspace()?.version ?? 0, savedBy, force, workspace }),
  );
  markWorkspace(meta.version, store);
  return meta;
}

/** Takes the team's catalogue, prices, settings and templates in place of this device's. */
export async function loadWorkspace(store: SampleStore): Promise<WorkspaceMeta> {
  const { meta, workspace } = await call<{ meta: WorkspaceMeta; workspace: Workspace }>(
    '/api/shared/workspace',
  );
  await downloadFiles(fileIdsIn(workspace));
  store.actions.importWorkspace(workspace);
  markWorkspace(meta.version, store);
  return meta;
}

/** Records that this device's catalogue and settings match the team's version as they are. */
export const acceptWorkspace = (store: SampleStore, version: number) =>
  markWorkspace(version, store);
