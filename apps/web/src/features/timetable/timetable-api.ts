import { useCallback, useEffect, useState } from 'react';
import type { Timetable, TimetableEvent } from '@maxsen/domain';
import { savedByName } from '@/lib/shared/api';

const CACHE = 'maxsen.timetable.cache';

export class TimetableError extends Error {
  constructor(
    message: string,
    /** The server wants admin unlocked (again) before this change. */
    readonly needsAdmin = false,
  ) {
    super(message);
  }
}

function cached(): Timetable | null {
  try {
    const raw = window.localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as Timetable) : null;
  } catch {
    return null;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        'content-type': 'application/json',
        // Shown as who last changed an appointment.
        'x-maxsen-name': encodeURIComponent(savedByName()).slice(0, 80),
        ...init?.headers,
      },
    });
  } catch {
    throw new TimetableError('The team server can’t be reached. Check the connection.');
  }
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (res.status === 403) throw new TimetableError(body?.message ?? 'Admin only.', true);
  if (!res.ok || !body) throw new TimetableError(body?.message ?? 'That didn’t go through.');
  return body;
}

export type EventInput = Omit<TimetableEvent, 'id' | 'updatedAt' | 'updatedBy'>;

export const saveEvent = (id: string, input: EventInput) =>
  call<{ event: TimetableEvent }>(`/api/timetable/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then((r) => r.event);

export const deleteEvent = (id: string) =>
  call<{ removed: boolean }>(`/api/timetable/events/${id}`, { method: 'DELETE' });

export const savePeople = (people: string[]) =>
  call<{ people: string[] }>('/api/timetable/people', {
    method: 'PUT',
    body: JSON.stringify({ people }),
  });

/**
 * The shared timetable: fetched on opening, every minute while in view, and after each change.
 * The last copy is kept on the device, so it still shows without a connection.
 */
export function useTimetable() {
  const [data, setData] = useState<Timetable | null>(cached);
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'unavailable'>('loading');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/timetable', { credentials: 'same-origin' });
      if (res.status === 503 || res.status === 404) {
        setState('unavailable');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as Timetable;
      setData(next);
      setState('live');
      try {
        window.localStorage.setItem(CACHE, JSON.stringify(next));
      } catch {
        // Shown live only.
      }
    } catch {
      setState((s) => (s === 'loading' && !cached() ? 'unavailable' : 'offline'));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    const onShow = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [refresh]);

  return { timetable: data ?? { events: [], people: [] }, state, refresh, setData };
}
