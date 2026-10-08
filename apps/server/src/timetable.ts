import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** An appointment as the admin saves it (who and when are added on the server). */
export const eventBody = z
  .object({
    kind: z.enum(['sales', 'installation']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: time,
    end: time,
    title: z.string().trim().min(1).max(160),
    client: z.string().trim().max(160).optional(),
    address: z.string().trim().max(300).optional(),
    people: z.array(z.string().trim().min(1).max(60)).max(30),
    projectId: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((e) => e.end > e.start, { message: 'Ends before it starts', path: ['end'] });

export type EventInput = z.infer<typeof eventBody>;

export interface StoredEvent extends EventInput {
  id: string;
  updatedAt: string;
  updatedBy: string;
}

interface TimetableFile {
  events: StoredEvent[];
  people: string[];
}

/**
 * The team timetable, one JSON file beside the shared projects (on Render, the persistent disk).
 * Each appointment is saved on its own, so two edits at once don't undo each other.
 */
export function createTimetableStore(dir: string) {
  const file = path.join(dir, 'timetable.json');
  const ready = mkdir(dir, { recursive: true });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };

  const read = async (): Promise<TimetableFile> => {
    await ready;
    try {
      const data = JSON.parse(await readFile(file, 'utf8')) as Partial<TimetableFile>;
      return { events: data.events ?? [], people: data.people ?? [] };
    } catch {
      return { events: [], people: [] };
    }
  };
  const write = async (data: TimetableFile) => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, file);
  };

  return {
    read,

    /** Adds or replaces one appointment. */
    put: (id: string, input: EventInput, by: string) =>
      serial(async () => {
        const data = await read();
        const event: StoredEvent = {
          ...input,
          id,
          updatedAt: new Date().toISOString(),
          updatedBy: by,
        };
        const at = data.events.findIndex((e) => e.id === id);
        if (at >= 0) data.events[at] = event;
        else data.events.push(event);
        // Anyone assigned joins the team list.
        for (const p of input.people) if (!data.people.includes(p)) data.people.push(p);
        await write(data);
        return event;
      }),

    remove: (id: string) =>
      serial(async () => {
        const data = await read();
        const events = data.events.filter((e) => e.id !== id);
        if (events.length === data.events.length) return false;
        await write({ ...data, events });
        return true;
      }),

    /** The team list, as the admin keeps it. */
    setPeople: (people: string[]) =>
      serial(async () => {
        const data = await read();
        await write({ ...data, people });
        return people;
      }),
  };
}

export type TimetableStore = ReturnType<typeof createTimetableStore>;
