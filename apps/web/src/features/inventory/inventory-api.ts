import { useCallback, useEffect, useState } from 'react';
import type { InventoryData, Movement, MovementKind, MovementLine } from '@maxsen/domain';
import { savedByName } from '@/lib/shared/api';

const CACHE = 'maxsen.inventory.cache';

export class InventoryError extends Error {
  constructor(
    message: string,
    /** Only the inventory manager (admin unlocked) can do this. */
    readonly needsManager = false,
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
        // Recorded as who took out, returned, restocked or checked.
        'x-maxsen-name': encodeURIComponent(savedByName()).slice(0, 80),
      },
    });
  } catch {
    throw new InventoryError('The team server can’t be reached. Check the connection.');
  }
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (res.status === 403)
    throw new InventoryError(body?.message ?? 'Inventory manager only.', true);
  if (!res.ok || !body) throw new InventoryError(body?.message ?? 'That didn’t go through.');
  return body;
}

export interface MovementInput {
  kind: MovementKind;
  lines: MovementLine[];
  site?: string;
  projectId?: string;
  note?: string;
}

export const recordMovement = (input: MovementInput) =>
  call<{ movement: Movement }>('/api/inventory/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.movement);

export const verifyMovement = (id: string, counts: Record<string, number>, note?: string) =>
  call<{ movement: Movement }>(`/api/inventory/movements/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ counts, ...(note ? { note } : {}) }),
  }).then((r) => r.movement);

export const removeMovement = (id: string) =>
  call<{ removed: boolean }>(`/api/inventory/movements/${id}`, { method: 'DELETE' });

export const saveMinimums = (minimums: Record<string, number>) =>
  call<{ minimums: Record<string, number> }>('/api/inventory/minimums', {
    method: 'PUT',
    body: JSON.stringify(minimums),
  });

function cached(): InventoryData | null {
  try {
    const raw = window.localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as InventoryData) : null;
  } catch {
    return null;
  }
}

/** The shared ledger: fetched on opening, every minute in view, and after each change. */
export function useInventory() {
  const [data, setData] = useState<InventoryData | null>(cached);
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'unavailable'>('loading');
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory', { credentials: 'same-origin' });
      if (res.status === 503 || res.status === 404) return setState('unavailable');
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as InventoryData;
      setData(next);
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
    }, 60_000);
    return () => window.clearInterval(t);
  }, [refresh]);
  return { data: data ?? { movements: [], minimums: {} }, state, refresh };
}
