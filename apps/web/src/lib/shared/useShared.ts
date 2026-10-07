import { useEffect, useState, useSyncExternalStore } from 'react';
import { listShared, sharedEnabled, type SharedMeta } from './api';

/**
 * The team's saved projects, fetched when the app opens, every minute after, when the app comes
 * back into view, and after each save or load here. Empty, and `enabled` false, where the app
 * runs without the server.
 */
interface SharedList {
  enabled: boolean;
  projects: SharedMeta[];
  error: string | null;
}

let current: SharedList = { enabled: false, projects: [], error: null };
const listeners = new Set<() => void>();
let started = false;
let enabledCheck: Promise<boolean> | null = null;

function set(next: Partial<SharedList>) {
  current = { ...current, ...next };
  for (const l of listeners) l();
}

/** Fetches the list again now. */
export async function refreshShared(): Promise<void> {
  enabledCheck ??= sharedEnabled();
  if (!(await enabledCheck)) {
    // Asked again on the next refresh, in case the server was only starting.
    enabledCheck = null;
    return;
  }
  try {
    set({ enabled: true, projects: await listShared(), error: null });
  } catch (e) {
    set({ enabled: true, error: e instanceof Error ? e.message : 'The team list couldn’t load.' });
  }
}

function start() {
  if (started) return;
  started = true;
  void refreshShared();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshShared();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshShared();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSharedList(): SharedList {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => current);
}

/** Re-renders every so often, for "saved 3 minutes ago". */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}
