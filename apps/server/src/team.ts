import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).optional();

/** A team member's profile, as the admin saves it. */
export const memberBody = z.object({
  name: z.string().trim().min(1).max(60),
  role: text(40),
  phone: text(30),
  email: text(160),
  joined: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: text(1000),
  active: z.boolean(),
});

type MemberInput = z.infer<typeof memberBody>;

/** A device's last copy of the team, sent back after the server lost its own. */
export const teamCopy = z.object({
  members: z
    .array(
      memberBody.extend({
        id: z.string().max(60),
        updatedAt: z.string().max(40),
        updatedBy: z.string().max(80),
      }),
    )
    .max(500),
});

export interface StoredMember extends MemberInput {
  id: string;
  updatedAt: string;
  updatedBy: string;
}

const idFor = () =>
  `tm_${Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(36).slice(-1)).join('')}`;

/**
 * The team, one JSON file beside the shared projects (on Render, the persistent disk). The
 * timetable assigns and messages people from it. The first time, it starts from the names and
 * numbers already on the timetable's team list.
 */
export function createTeamStore(dir: string) {
  const file = path.join(dir, 'team.json');
  const ready = mkdir(dir, { recursive: true });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };
  /** `onlySeeded`: only copied from the timetable so far, nobody has saved it. */
  const write = async (members: StoredMember[], onlySeeded = false) => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(onlySeeded ? { members, seeded: true } : { members }));
    await rename(tmp, file);
  };
  /** The timetable's team list from before there was a Team tab. */
  const fromTimetable = async (): Promise<StoredMember[]> => {
    try {
      const t = JSON.parse(await readFile(path.join(dir, 'timetable.json'), 'utf8')) as {
        people?: string[];
        phones?: Record<string, string>;
      };
      const now = new Date().toISOString();
      return (t.people ?? []).map((name) => ({
        id: idFor(),
        name,
        ...(t.phones?.[name] ? { phone: t.phones[name] } : {}),
        active: true,
        updatedAt: now,
        updatedBy: 'Timetable',
      }));
    } catch {
      return [];
    }
  };
  /**
   * The first time, the timetable's list is written as the team, once, so ids stay put. With no
   * timetable yet (or one being put back after the server lost its data), nothing is written.
   */
  let seeded: Promise<void> | null = null;
  const seed = () =>
    (seeded ??= (async () => {
      await ready;
      try {
        await readFile(file, 'utf8');
      } catch {
        const members = await fromTimetable();
        if (members.length) await write(members, true);
        else seeded = null;
      }
    })());
  const read = async (): Promise<StoredMember[]> => {
    await seed();
    try {
      return (
        (JSON.parse(await readFile(file, 'utf8')) as { members?: StoredMember[] }).members ?? []
      );
    } catch {
      return [];
    }
  };

  /** Nobody has saved the team on this server: it's new, or lost its data. */
  const fresh = async () => {
    await ready;
    try {
      return (JSON.parse(await readFile(file, 'utf8')) as { seeded?: boolean }).seeded === true;
    } catch {
      return true;
    }
  };

  return {
    read,
    fresh,

    /** Puts back a device's last copy, only while nobody has saved the team on this server. */
    restore: (copy: z.infer<typeof teamCopy>) =>
      serial(async () => {
        if (!(await fresh())) return false;
        await write(copy.members);
        seeded = Promise.resolve();
        return true;
      }),

    save: (id: string, input: MemberInput, by: string) =>
      serial(async () => {
        const members = await read();
        if (members.some((m) => m.id !== id && m.name.toLowerCase() === input.name.toLowerCase()))
          return { ok: false as const, message: `${input.name} is already on the team.` };
        const member: StoredMember = {
          ...input,
          id,
          updatedAt: new Date().toISOString(),
          updatedBy: by,
        };
        const at = members.findIndex((m) => m.id === id);
        if (at >= 0) members[at] = member;
        else members.push(member);
        await write(members);
        return { ok: true as const, member };
      }),

    remove: (id: string) =>
      serial(async () => {
        const members = await read();
        const left = members.filter((m) => m.id !== id);
        if (left.length === members.length) return false;
        await write(left);
        return true;
      }),

    /** Someone assigned on the timetable who isn't on the team yet joins it. */
    ensure: (names: string[], by: string) =>
      serial(async () => {
        const members = await read();
        const known = new Set(members.map((m) => m.name.toLowerCase()));
        const added = names.filter((n) => !known.has(n.toLowerCase()));
        if (!added.length) return;
        const now = new Date().toISOString();
        await write([
          ...members,
          ...added.map((name) => ({
            id: idFor(),
            name,
            active: true,
            updatedAt: now,
            updatedBy: by,
          })),
        ]);
      }),
  };
}

export type TeamStore = ReturnType<typeof createTeamStore>;
