import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const receipt = z.object({
  id: z.string().regex(/^rcpt_[A-Za-z0-9]{4,40}$/),
  name: z.string().trim().max(160),
  type: z.string().max(80),
});

/** A claim as the person claiming saves it. */
export const claimBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().finite().positive().max(1_000_000),
  purpose: z.string().trim().min(1).max(1000),
  category: z.string().trim().max(60).optional(),
  site: z.string().trim().max(200).optional(),
  receipts: z.array(receipt).min(1).max(20),
});

export const decisionBody = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional(),
});

type ClaimInput = z.infer<typeof claimBody>;

export interface StoredClaim extends ClaimInput {
  id: string;
  claimant: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** Receipts are photos or PDFs; anything bigger is refused. */
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;
export const RECEIPT_TYPES = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;
export const RECEIPT_ID = /^rcpt_[A-Za-z0-9]{4,40}$/;

export type ClaimSave =
  | { ok: true; claim: StoredClaim }
  | { ok: false; reason: 'decided' | 'not-found'; current?: StoredClaim };

/**
 * The team's claims, one JSON file beside the shared projects (on Render, the persistent disk),
 * and their receipts in a folder of their own. A claim can be changed or withdrawn while it waits
 * for approval; once decided, it stays as it was.
 */
export function createClaimStore(dir: string) {
  const file = path.join(dir, 'claims.json');
  const receipts = path.join(dir, 'receipts');
  const ready = mkdir(receipts, { recursive: true });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async (): Promise<StoredClaim[]> => {
    await ready;
    try {
      return (JSON.parse(await readFile(file, 'utf8')) as { claims?: StoredClaim[] }).claims ?? [];
    } catch {
      return [];
    }
  };
  const write = async (claims: StoredClaim[]) => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify({ claims }));
    await rename(tmp, file);
  };
  const now = () => new Date().toISOString();

  return {
    read,

    /** A new claim, or changes to one still waiting for approval. */
    save: (id: string, input: ClaimInput, by: string): Promise<ClaimSave> =>
      serial(async () => {
        const claims = await read();
        const at = claims.findIndex((c) => c.id === id);
        const current = at >= 0 ? claims[at] : undefined;
        if (current && current.status !== 'pending')
          return { ok: false, reason: 'decided', current };
        const claim: StoredClaim = {
          ...input,
          id,
          claimant: current?.claimant ?? by,
          status: 'pending',
          createdAt: current?.createdAt ?? now(),
          updatedAt: now(),
        };
        if (current) claims[at] = claim;
        else claims.push(claim);
        await write(claims);
        return { ok: true, claim };
      }),

    /** The admin's decision. */
    decide: (id: string, status: 'approved' | 'rejected', by: string, note?: string) =>
      serial(async () => {
        const claims = await read();
        const claim = claims.find((c) => c.id === id);
        if (!claim) return null;
        claim.status = status;
        claim.decidedBy = by;
        claim.decidedAt = now();
        if (note) claim.note = note;
        else delete claim.note;
        claim.updatedAt = now();
        await write(claims);
        return claim;
      }),

    /** Withdrawn while waiting (or removed by the admin); its receipts go with it. */
    remove: (id: string, admin: boolean): Promise<'removed' | 'not-found' | 'decided'> =>
      serial(async () => {
        const claims = await read();
        const claim = claims.find((c) => c.id === id);
        if (!claim) return 'not-found';
        if (claim.status !== 'pending' && !admin) return 'decided';
        await write(claims.filter((c) => c.id !== id));
        await Promise.all(
          claim.receipts.map((r) => rm(path.join(receipts, r.id), { force: true })),
        );
        await Promise.all(
          claim.receipts.map((r) => rm(path.join(receipts, `${r.id}.type`), { force: true })),
        );
        return 'removed';
      }),

    async putReceipt(id: string, data: Uint8Array, type: string) {
      await ready;
      const tmp = path.join(receipts, `${id}.${process.pid}.tmp`);
      await writeFile(tmp, data);
      await rename(tmp, path.join(receipts, id));
      await writeFile(path.join(receipts, `${id}.type`), type);
    },

    async getReceipt(id: string): Promise<{ data: Buffer; type: string } | null> {
      await ready;
      const f = path.join(receipts, id);
      try {
        await stat(f);
      } catch {
        return null;
      }
      const type = await readFile(`${f}.type`, 'utf8').catch(() => 'application/octet-stream');
      return { data: await readFile(f), type };
    },
  };
}

export type ClaimStore = ReturnType<typeof createClaimStore>;
