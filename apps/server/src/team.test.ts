import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { createTeamStore } from './team.ts';
import { createTimetableStore } from './timetable.ts';

const send = (method: string, body: unknown, cookie = '') => ({
  method,
  headers: { 'content-type': 'application/json', 'x-maxsen-name': 'Boss', cookie },
  body: JSON.stringify(body),
});
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
type Member = { id: string; name: string; phone?: string; active: boolean; role?: string };

describe('team', () => {
  it('only the exclusive admin sees and keeps it; the timetable follows', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'team-'));
    writeFileSync(
      path.join(dir, 'timetable.json'),
      JSON.stringify({ events: [], people: ['Jo', 'Sam'], phones: { Jo: '+65 9123 4567' } }),
    );
    const app = buildApp({
      auth: createAuth({ exclusivePasscode: 'owner-pass' }),
      team: createTeamStore(dir),
      timetable: createTimetableStore(dir),
    });
    const unlock = async (passcode: string) => {
      const res = await app.request('/api/auth/admin', send('POST', { passcode }));
      return {
        body: (await res.json()) as { ok: boolean; exclusive: boolean },
        cookie: cookieOf(res),
      };
    };

    // Signed in, or admin: the team stays private.
    expect((await app.request('/api/team')).status).toBe(403);
    const admin = await unlock('admin');
    expect(admin.body).toEqual({ ok: true, exclusive: false });
    expect((await app.request('/api/team', { headers: { cookie: admin.cookie } })).status).toBe(
      403,
    );
    const owner = await unlock('owner-pass');
    expect(owner.body).toEqual({ ok: true, exclusive: true });
    const status = await app.request('/api/auth/status', { headers: { cookie: owner.cookie } });
    expect(await status.json()).toMatchObject({ admin: true, exclusive: true });

    // Starts from the timetable's list, with the same ids each time.
    const list = async () =>
      (
        (await (await app.request('/api/team', { headers: { cookie: owner.cookie } })).json()) as {
          members: Member[];
        }
      ).members;
    const first = await list();
    expect(first.map((m) => [m.name, m.phone, m.active])).toEqual([
      ['Jo', '+65 9123 4567', true],
      ['Sam', undefined, true],
    ]);
    expect((await list()).map((m) => m.id)).toEqual(first.map((m) => m.id));

    const sam = first.find((m) => m.name === 'Sam')!;
    const update = { name: 'Sam', role: 'Installer', phone: '+65 8123 4567', active: true };
    expect(
      (await app.request(`/api/team/${sam.id}`, send('PUT', update, admin.cookie))).status,
    ).toBe(403);
    const saved = await app.request(`/api/team/${sam.id}`, send('PUT', update, owner.cookie));
    expect(await saved.json()).toMatchObject({ member: { role: 'Installer', updatedBy: 'Boss' } });
    // No two people of the same name.
    const dup = await app.request(
      '/api/team/tm_newperson1',
      send('PUT', { name: 'jo', active: true }, owner.cookie),
    );
    expect(dup.status).toBe(409);

    // Jo leaves: no longer assigned or messaged from the timetable.
    const jo = first.find((m) => m.name === 'Jo')!;
    await app.request(
      `/api/team/${jo.id}`,
      send('PUT', { name: 'Jo', active: false }, owner.cookie),
    );
    const timetable = async (cookie = '') =>
      (await app.request('/api/timetable', { headers: { cookie } })).json();
    expect(await timetable(admin.cookie)).toMatchObject({
      people: ['Sam'],
      phones: { Sam: '+65 8123 4567' },
    });
    // The rest of the team sees who's assigned, not their numbers.
    expect(await timetable()).toMatchObject({ people: ['Sam'], phones: {} });
  });

  it('can’t be opened at all without an exclusive admin passcode set', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'team-'));
    const app = buildApp({ team: createTeamStore(dir) });
    const res = await app.request('/api/auth/admin', send('POST', { passcode: 'admin' }));
    expect(await res.json()).toEqual({ ok: true, exclusive: false });
    expect((await app.request('/api/team', { headers: { cookie: cookieOf(res) } })).status).toBe(
      403,
    );
  });
});
