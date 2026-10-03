/**
 * Uploaded files (drawings, rendered pages, logos, product images) live in IndexedDB as blobs and
 * are served to the UI as object URLs. Phase B replaces this with the server's blob store.
 */
import { newId } from '@maxsen/domain';

const DB_NAME = 'maxsen-planner';
const STORE = 'files';
const urls = new Map<string, string>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

/** Loads every stored file so `storedFileUrl` can answer synchronously during render. */
export async function initFileStore(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const keys = (await tx('readonly', (s) => s.getAllKeys())) as string[];
    const blobs = (await tx('readonly', (s) => s.getAll())) as Blob[];
    keys.forEach((k, i) => {
      const blob = blobs[i];
      if (blob) urls.set(k, URL.createObjectURL(blob));
    });
  } catch (e) {
    console.warn('File storage unavailable; uploads will not survive a reload.', e);
  }
}

export async function putFile(blob: Blob): Promise<string> {
  const id = newId('file');
  urls.set(id, URL.createObjectURL(blob));
  if (typeof indexedDB !== 'undefined') {
    try {
      await tx('readwrite', (s) => s.put(blob, id));
    } catch (e) {
      console.warn('Could not store file', e);
    }
  }
  return id;
}

export function storedFileUrl(fileId: string): string | undefined {
  return urls.get(fileId);
}

export async function clearFiles(): Promise<void> {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  if (typeof indexedDB !== 'undefined')
    await tx('readwrite', (s) => s.clear()).catch(() => undefined);
}
