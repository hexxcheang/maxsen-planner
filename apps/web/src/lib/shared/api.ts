import type { SharedState } from '@maxsen/domain';
import type { SampleStore } from '../data/sample-store';
import { putFileWithId, storedFileBlob, storedFileUrl } from '../storage/file-store';
import { bundleFileIds, bundleFingerprint, projectBundle, type ProjectBundle } from './bundle';

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

export class SharedError extends Error {
  constructor(
    message: string,
    readonly conflict?: SharedMeta,
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
    throw new SharedError(OFFLINE);
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

/** Whether this app is served with team saving (the online app, or `pnpm dev` with the server). */
export async function sharedEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/shared/status', { credentials: 'same-origin' });
    if (!res.ok) return false;
    return ((await res.json()) as { enabled?: boolean }).enabled === true;
  } catch {
    return false;
  }
}

export const listShared = () =>
  call<{ projects: SharedMeta[] }>('/api/shared/projects').then((r) => r.projects);

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
  const { missing } = await call<{ missing: string[] }>(
    '/api/shared/files/missing',
    json('POST', { ids: bundleFileIds(bundle) }),
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
  for (const id of bundleFileIds(bundle)) {
    if (storedFileUrl(id)) continue;
    try {
      const res = await fetch(`/api/shared/files/${id}`, { credentials: 'same-origin' });
      if (res.ok) await putFileWithId(id, await res.blob());
    } catch {
      throw new SharedError(OFFLINE);
    }
  }
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
