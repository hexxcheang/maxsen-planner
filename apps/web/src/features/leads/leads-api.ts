import { useCallback, useEffect, useState } from 'react';
import type { Lead } from '@maxsen/domain';
import { savedByName } from '@/lib/shared/api';

const CACHE = 'maxsen.leads.cache';

export class LeadError extends Error {
  constructor(
    message: string,
    /** Someone else saved this lead since it was opened: their version. */
    readonly current?: Lead,
    readonly needsAdmin = false,
  ) {
    super(message);
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
        'x-maxsen-name': encodeURIComponent(savedByName()).slice(0, 80),
      },
    });
  } catch {
    throw new LeadError('The team server can’t be reached. Check the connection.');
  }
  const body = (await res.json().catch(() => null)) as
    (T & { message?: string; lead?: Lead }) | null;
  if (res.status === 409)
    throw new LeadError(body?.message ?? 'Changed by someone else.', body?.lead);
  if (res.status === 403) throw new LeadError(body?.message ?? 'Admin only.', undefined, true);
  if (!res.ok || !body) throw new LeadError(body?.message ?? 'That didn’t go through.');
  return body;
}

export type LeadInput = Omit<
  Lead,
  'id' | 'notes' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
> & { baseUpdatedAt?: string };

export const saveLead = (id: string, input: LeadInput) =>
  call<{ lead: Lead }>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then(
    (r) => r.lead,
  );

export const addLeadNote = (id: string, text: string) =>
  call<{ lead: Lead }>(`/api/leads/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }).then((r) => r.lead);

export const deleteLead = (id: string) =>
  call<{ removed: boolean }>(`/api/leads/${id}`, { method: 'DELETE' });

function cached(): Lead[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as Lead[]) : null;
  } catch {
    return null;
  }
}

/**
 * The team's leads: fetched on opening, every 30 seconds in view, and after each change. The last
 * copy stays on the device, to show without a connection.
 */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[] | null>(cached);
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'unavailable'>('loading');
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/leads', { credentials: 'same-origin' });
      if (res.status === 503 || res.status === 404) return setState('unavailable');
      if (!res.ok) throw new Error(String(res.status));
      const next = ((await res.json()) as { leads: Lead[] }).leads;
      setLeads(next);
      setState('live');
      try {
        window.localStorage.setItem(CACHE, JSON.stringify(next));
      } catch {
        // Shown live only.
      }
    } catch {
      setState(cached() ? 'offline' : 'unavailable');
    }
  }, []);
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    const onShow = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [refresh]);
  /** Puts a saved lead in the list at once, without waiting for the next fetch. */
  const put = (lead: Lead) =>
    setLeads((ls) => [...(ls ?? []).filter((l) => l.id !== lead.id), lead]);
  const drop = (id: string) => setLeads((ls) => (ls ?? []).filter((l) => l.id !== id));
  return { leads: leads ?? [], state, refresh, put, drop };
}
