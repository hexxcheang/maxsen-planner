import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
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
  it('starts from the timetable’s list; only the admin changes it; the timetable follows', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'team-'));
    writeFileSync(
      path.join(dir, 'timetable.json'),
      JSON.stringify({ events: [], people: ['Jo', 'Sam'], phones: { Jo: '+65 9123 4567' } }),
    );
    const app = buildApp({ team: createTeamStore(dir), timetable: createTimetableStore(dir) });
    const first = ((await (await app.request('/api/team')).json()) as { members: Member[] })
      .members;
    expect(first.map((m) => [m.name, m.phone, m.active])).toEqual([
      ['Jo', '+65 9123 4567', true],
      ['Sam', undefined, true],
    ]);
    // The same people, with the same ids, each time.
    const again = ((await (await app.request('/api/team')).json()) as { members: Member[] })
      .members;
    expect(again.map((m) => m.id)).toEqual(first.map((m) => m.id));

    const sam = first.find((m) => m.name === 'Sam')!;
    const update = { name: 'Sam', role: 'Installer', phone: '+65 8123 4567', active: true };
    expect((await app.request(`/api/team/${sam.id}`, send('PUT', update))).status).toBe(403);
    const admin = cookieOf(
      await app.request('/api/auth/admin', send('POST', { passcode: 'admin' })),
    );
    const saved = await app.request(`/api/team/${sam.id}`, send('PUT', update, admin));
    expect(await saved.json()).toMatchObject({ member: { role: 'Installer', updatedBy: 'Boss' } });
    // No two people of the same name.
    const dup = await app.request(
      '/api/team/tm_newperson1',
      send('PUT', { name: 'jo', active: true }, admin),
    );
    expect(dup.status).toBe(409);

    // Jo leaves: no longer assigned or messaged from the timetable.
    const jo = first.find((m) => m.name === 'Jo')!;
    await app.request(`/api/team/${jo.id}`, send('PUT', { name: 'Jo', active: false }, admin));
    expect(await (await app.request('/api/timetable')).json()).toMatchObject({
      people: ['Sam'],
      phones: { Sam: '+65 8123 4567' },
    });
  });
});
