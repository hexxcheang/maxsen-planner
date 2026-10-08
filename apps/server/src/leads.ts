import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).optional();

/** A lead's details as anyone saves them (notes are added on their own). */
export const leadBody = z.object({
  name: z.string().trim().min(1).max(160),
  phone: text(40),
  email: text(160),
  address: text(300),
  propertyType: text(60),
  source: text(60),
  interest: text(300),
  budget: text(60),
  status: z.enum(['new', 'contacted', 'meeting', 'quoted', 'won', 'lost']),
  assignedTo: text(60),
  followUp: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  projectId: text(60),
  /** The lead's `updatedAt` this edit started from; a newer one on the server is a conflict. */
  baseUpdatedAt: z.string().optional(),
});

export const noteBody = z.object({ text: z.string().trim().min(1).max(2000) });

type LeadInput = z.infer<typeof leadBody>;

interface Note {
  at: string;
  by: string;
  text: string;
}

export interface StoredLead extends Omit<LeadInput, 'baseUpdatedAt'> {
  id: string;
  notes: Note[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type LeadSave = { ok: true; lead: StoredLead } | { ok: false; current: StoredLead };

/**
 * The team's leads, one JSON file beside the shared projects (on Render, the persistent disk).
 * Each lead is saved on its own, and notes are appended, so people working on different leads,
 * or noting the same one, never undo each other; two edits of one lead's details are caught.
 */
export function createLeadStore(dir: string) {
  const file = path.join(dir, 'leads.json');
  const ready = mkdir(dir, { recursive: true });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async (): Promise<StoredLead[]> => {
    await ready;
    try {
      return (JSON.parse(await readFile(file, 'utf8')) as { leads?: StoredLead[] }).leads ?? [];
    } catch {
      return [];
    }
  };
  const write = async (leads: StoredLead[]) => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify({ leads }));
    await rename(tmp, file);
  };
  const now = () => new Date().toISOString();

  return {
    read,

    save: (id: string, input: LeadInput, by: string): Promise<LeadSave> =>
      serial(async () => {
        const leads = await read();
        const at = leads.findIndex((l) => l.id === id);
        const current = at >= 0 ? leads[at] : undefined;
        if (current && input.baseUpdatedAt && input.baseUpdatedAt !== current.updatedAt)
          return { ok: false, current };
        const { baseUpdatedAt: _b, ...details } = input;
        const lead: StoredLead = {
          ...details,
          id,
          notes: current?.notes ?? [],
          createdAt: current?.createdAt ?? now(),
          createdBy: current?.createdBy ?? by,
          updatedAt: now(),
          updatedBy: by,
        };
        if (current) leads[at] = lead;
        else leads.push(lead);
        await write(leads);
        return { ok: true, lead };
      }),

    addNote: (id: string, note: string, by: string) =>
      serial(async () => {
        const leads = await read();
        const lead = leads.find((l) => l.id === id);
        if (!lead) return null;
        lead.notes.push({ at: now(), by, text: note });
        await write(leads);
        return lead;
      }),

    remove: (id: string) =>
      serial(async () => {
        const leads = await read();
        const left = leads.filter((l) => l.id !== id);
        if (left.length === leads.length) return false;
        await write(left);
        return true;
      }),
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
