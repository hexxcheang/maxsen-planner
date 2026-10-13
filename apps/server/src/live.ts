import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

/** What changed, named after the part of the app: `timetable`, `leads`, `team`, … */
export type Topic = string;

/**
 * Tells every open copy of the app the moment something shared changes, so each fetches the new
 * version at once instead of waiting for its next refresh. Only names what changed; the data is
 * still read the usual way, with the usual checks.
 */
export function createLive() {
  const listeners = new Set<(topic: Topic) => void>();
  return {
    publish: (topic: Topic) => {
      for (const l of listeners) l(topic);
    },
    /** The stream a device keeps open. A comment every 25 s keeps proxies from closing it. */
    stream: (c: Context) =>
      streamSSE(c, async (s) => {
        let closed = false;
        const send = (topic: Topic) => void s.writeSSE({ event: 'changed', data: topic });
        listeners.add(send);
        s.onAbort(() => {
          closed = true;
          listeners.delete(send);
        });
        await s.writeSSE({ event: 'ready', data: '' });
        while (!closed) {
          await s.sleep(25_000);
          if (!closed) await s.write(': ping\n\n');
        }
      }),
  };
}

export type Live = ReturnType<typeof createLive>;

/** The topic a change to this API path is about, if anyone else is shown it live. */
export function topicOf(path: string): Topic | null {
  const m = /^\/api\/(timetable|leads|team|claims|inventory|shared)(\/|$)/.exec(path);
  if (!m) return null;
  return m[1] === 'shared' ? 'projects' : m[1]!;
}
