import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const line = z.object({
  variantId: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  qty: z.number().finite(),
});

/** A movement as it's recorded (who and when are added on the server). */
export const movementBody = z
  .object({
    kind: z.enum(['restock', 'checkout', 'return', 'adjust']),
    lines: z.array(line).min(1).max(200),
    site: z.string().trim().max(200).optional(),
    projectId: z.string().max(60).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((m) => m.kind === 'adjust' || m.lines.every((l) => l.qty > 0), {
    message: 'Quantities must be more than 0.',
  })
  .refine((m) => (m.kind !== 'checkout' && m.kind !== 'return') || !!m.site, {
    message: 'Say which site it’s for.',
  });

export const verifyBody = z.object({
  counts: z.record(z.string(), z.number().finite().min(0)),
  note: z.string().trim().max(1000).optional(),
});

export type MovementInput = z.infer<typeof movementBody>;

interface StoredMovement extends MovementInput {
  id: string;
  at: string;
  by: string;
  verified?: { by: string; at: string; counts: Record<string, number>; note?: string };
}

interface InventoryFile {
  movements: StoredMovement[];
  minimums: Record<string, number>;
}

/** Only the inventory manager (admin) restocks and corrects counts; anyone signed in takes out. */
export const MANAGER_KINDS = new Set(['restock', 'adjust']);

/**
 * The stock ledger, one JSON file beside the shared projects (on Render, the persistent disk).
 */
export function createInventoryStore(dir: string) {
  const file = path.join(dir, 'inventory.json');
  const ready = mkdir(dir, { recursive: true });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async (): Promise<InventoryFile> => {
    await ready;
    try {
      const data = JSON.parse(await readFile(file, 'utf8')) as Partial<InventoryFile>;
      return { movements: data.movements ?? [], minimums: data.minimums ?? {} };
    } catch {
      return { movements: [], minimums: {} };
    }
  };
  const write = async (data: InventoryFile) => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, file);
  };

  return {
    read,

    add: (input: MovementInput, by: string) =>
      serial(async () => {
        const data = await read();
        const m: StoredMovement = {
          ...input,
          id: `mv_${randomBytes(6).toString('hex')}`,
          at: new Date().toISOString(),
          by,
        };
        data.movements.push(m);
        await write(data);
        return m;
      }),

    /** The inventory manager's check of a take-out: what was really taken for the site. */
    verify: (id: string, counts: Record<string, number>, by: string, note?: string) =>
      serial(async () => {
        const data = await read();
        const m = data.movements.find((x) => x.id === id && x.kind === 'checkout');
        if (!m) return null;
        m.verified = { by, at: new Date().toISOString(), counts, ...(note ? { note } : {}) };
        await write(data);
        return m;
      }),

    /** Takes a mistaken entry off the ledger. */
    remove: (id: string) =>
      serial(async () => {
        const data = await read();
        const movements = data.movements.filter((m) => m.id !== id);
        if (movements.length === data.movements.length) return false;
        await write({ ...data, movements });
        return true;
      }),

    setMinimums: (minimums: Record<string, number>) =>
      serial(async () => {
        const data = await read();
        await write({ ...data, minimums });
        return minimums;
      }),
  };
}

export type InventoryStore = ReturnType<typeof createInventoryStore>;
