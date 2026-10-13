import { useEffect, useRef } from 'react';

type Listener = () => void;

/**
 * One connection per open app that the server uses to say what the team just changed
 * (`timetable`, `leads`, `team`, `claims`, `inventory`, `projects`), so screens fetch it at once.
 * It reconnects by itself (after a dropped connection or an app update), and on reconnecting
 * everything is fetched again, in case something changed while it was away.
 */
const listeners = new Map<string, Set<Listener>>();
let source: EventSource | null = null;
let dropped = false;

function connect() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/live', { withCredentials: true });
  source.addEventListener('changed', (e) => {
    for (const l of listeners.get((e as MessageEvent<string>).data) ?? []) l();
  });
  source.addEventListener('ready', () => {
    if (!dropped) return;
    dropped = false;
    for (const set of listeners.values()) for (const l of set) l();
  });
  source.addEventListener('error', () => {
    dropped = true;
  });
}

function disconnectIfIdle() {
  if ([...listeners.values()].some((s) => s.size)) return;
  source?.close();
  source = null;
  dropped = false;
}

/** Listens for changes to `topic` until the returned function is called. */
export function onLive(topic: string, listener: Listener): () => void {
  let set = listeners.get(topic);
  if (!set) listeners.set(topic, (set = new Set()));
  set.add(listener);
  connect();
  return () => {
    set.delete(listener);
    disconnectIfIdle();
  };
}

/** Calls `refresh` whenever the team changes any of `topics`, while the screen is open. */
export function useLive(topics: string[], refresh: () => unknown) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const key = topics.join(',');
  useEffect(() => {
    const offs = key.split(',').map((t) => onLive(t, () => void latest.current()));
    return () => offs.forEach((off) => off());
  }, [key]);
}
