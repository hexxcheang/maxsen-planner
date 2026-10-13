import { useCallback, useEffect, useState } from 'react';
import type { TeamMember } from '@maxsen/domain';
import { useLive } from '@/lib/live';
import { putBack } from '@/lib/put-back';
import { savedByName } from '@/lib/shared/api';

const CACHE = 'maxsen.team.cache';

export class TeamError extends Error {
  constructor(
    message: string,
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
    throw new TeamError('The team server can’t be reached. Check the connection.');
  }
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (res.status === 403) throw new TeamError(body?.message ?? 'Admin only.', true);
  if (!res.ok || !body) throw new TeamError(body?.message ?? 'That didn’t go through.');
  return body;
}

export type MemberInput = Omit<TeamMember, 'id' | 'updatedAt' | 'updatedBy'>;

export const saveMember = (id: string, input: MemberInput) =>
  call<{ member: TeamMember }>(`/api/team/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then((r) => r.member);

export const deleteMember = (id: string) =>
  call<{ removed: boolean }>(`/api/team/${id}`, { method: 'DELETE' });

function cached(): TeamMember[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as TeamMember[]) : null;
  } catch {
    return null;
  }
}

/** The team: fetched on opening and when the app comes back into view; kept for offline. */
export function useTeam() {
  const [members, setMembers] = useState<TeamMember[] | null>(cached);
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'unavailable'>('loading');
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/team', { credentials: 'same-origin' });
      if (res.status === 503 || res.status === 404) return setState('unavailable');
      if (!res.ok) throw new Error(String(res.status));
      const { members: next, fresh } = (await res.json()) as {
        members: TeamMember[];
        fresh?: boolean;
      };
      // The server lost the team: this device's last copy puts it back.
      const copy = cached();
      if (fresh && copy?.length && (await putBack('/api/team/restore', { members: copy })))
        return void (await refresh());
      setMembers(next);
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
    const onShow = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [refresh]);
  const put = (m: TeamMember) =>
    setMembers((ms) => [...(ms ?? []).filter((x) => x.id !== m.id), m]);
  const drop = (id: string) => setMembers((ms) => (ms ?? []).filter((x) => x.id !== id));
  // Someone assigned on the timetable who wasn't on the team joins it.
  useLive(['team', 'timetable'], refresh);
  return { members: members ?? [], state, refresh, put, drop };
}
