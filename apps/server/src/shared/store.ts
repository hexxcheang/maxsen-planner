import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** What the team sees of a saved project without downloading it. */
export interface SharedMeta {
  id: string;
  title: string;
  customerName: string;
  propertyAddress: string;
  status: string;
  /** Counts up on every save, so a save over someone else's newer one can be caught. */
  version: number;
  savedAt: string;
  savedBy: string;
}

export interface SharedProject {
  meta: SharedMeta;
  bundle: unknown;
}

export type SaveResult = { ok: true; meta: SharedMeta } | { ok: false; conflict: SharedMeta };

/** Project and file ids as the app makes them: a prefix, an underscore and letters or digits. */
export const ID = /^[a-z]+_[A-Za-z0-9]{4,40}$/;

/**
 * Projects saved for the whole team, as JSON files in a folder (on Render, a persistent disk), with
 * their drawings and pictures beside them. One save replaces the project's previous one.
 */
export function createSharedStore(dir: string) {
  const projects = path.join(dir, 'projects');
  const files = path.join(dir, 'files');
  const ready = Promise.all([
    mkdir(projects, { recursive: true }),
    mkdir(files, { recursive: true }),
  ]);
  // Saves run one at a time, so two at once can't both pass the version check.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };

  const writeAtomic = async (file: string, data: string | Uint8Array) => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);
  };

  const read = async (id: string): Promise<SharedProject | null> => {
    await ready;
    try {
      return JSON.parse(await readFile(path.join(projects, `${id}.json`), 'utf8')) as SharedProject;
    } catch {
      return null;
    }
  };

  return {
    dir,

    async list(): Promise<SharedMeta[]> {
      await ready;
      const names = (await readdir(projects)).filter((n) => n.endsWith('.json'));
      const metas = await Promise.all(
        names.map(async (n) => (await read(n.slice(0, -5)))?.meta ?? null),
      );
      return metas
        .filter((m): m is SharedMeta => m !== null)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    get: read,

    /**
     * Saves over version `baseVersion`; if someone has saved since, nothing changes and their
     * version comes back as a conflict, unless `force` is set.
     */
    save(
      id: string,
      input: { baseVersion: number; savedBy: string; bundle: unknown; force?: boolean },
      details: Pick<SharedMeta, 'title' | 'customerName' | 'propertyAddress' | 'status'>,
    ): Promise<SaveResult> {
      return serial(async () => {
        const current = await read(id);
        const version = current?.meta.version ?? 0;
        if (current && version !== input.baseVersion && !input.force)
          return { ok: false, conflict: current.meta };
        const meta: SharedMeta = {
          id,
          ...details,
          version: version + 1,
          savedAt: new Date().toISOString(),
          savedBy: input.savedBy,
        };
        await writeAtomic(
          path.join(projects, `${id}.json`),
          JSON.stringify({ meta, bundle: input.bundle } satisfies SharedProject),
        );
        return { ok: true, meta };
      });
    },

    /** The ids among `ids` not stored yet. */
    async missingFiles(ids: string[]): Promise<string[]> {
      await ready;
      return ids.filter((id) => ID.test(id) && !existsSync(path.join(files, id)));
    },

    async putFile(id: string, data: Uint8Array, type: string) {
      await ready;
      await writeAtomic(path.join(files, id), data);
      await writeFile(path.join(files, `${id}.type`), type || 'application/octet-stream');
    },

    async getFile(id: string): Promise<{ data: Buffer; type: string } | null> {
      await ready;
      const file = path.join(files, id);
      try {
        await stat(file);
      } catch {
        return null;
      }
      const type = await readFile(`${file}.type`, 'utf8').catch(() => 'application/octet-stream');
      return { data: await readFile(file), type };
    },
  };
}

export type SharedStore = ReturnType<typeof createSharedStore>;
