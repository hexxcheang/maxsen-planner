import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { createTimetableStore } from './timetable.ts';

const send = (method: string, body: unknown, cookie = '') => ({
  method,
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify(body),
});
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

const meetUp = {
  kind: 'sales',
  date: '2026-10-12',
  start: '10:00',
  end: '11:00',
  title: 'Showroom visit',
  client: 'Mr Lim',
  people: ['Jo'],
};

describe('the team timetable', () => {
  const online = () =>
    buildApp({
      auth: createAuth({ passcode: 'tampines', adminPasscode: 'boss' }),
      timetable: createTimetableStore(mkdtempSync(path.join(tmpdir(), 'tt-'))),
    });

  it('everyone signed in reads it; only the admin, unlocked on the server, changes it', async () => {
    const app = online();
    const team = cookieOf(
      await app.request('/api/auth/sign-in', send('POST', { passcode: 'tampines' })),
    );
    expect(
      await (await app.request('/api/timetable', { headers: { cookie: team } })).json(),
    ).toEqual({ events: [], people: [] });

    // Signed in but not admin: refused.
    const refused = await app.request(
      '/api/timetable/events/tt_aaaa1111',
      send('PUT', meetUp, team),
    );
    expect(refused.status).toBe(403);

    // A wrong admin passcode doesn't unlock; the right one does.
    const wrong = await app.request('/api/auth/admin', send('POST', { passcode: 'admin' }, team));
    expect(wrong.status).toBe(401);
    const unlocked = await app.request('/api/auth/admin', send('POST', { passcode: 'boss' }, team));
    expect(unlocked.status).toBe(200);
    const admin = `${team}; ${cookieOf(unlocked)}`;
    expect(
      await (await app.request('/api/auth/status', { headers: { cookie: admin } })).json(),
    ).toMatchObject({ signedIn: true, admin: true });

    const saved = await app.request('/api/timetable/events/tt_aaaa1111', {
      ...send('PUT', meetUp, admin),
      headers: { 'content-type': 'application/json', cookie: admin, 'x-maxsen-name': 'Hexiang' },
    });
    expect(await saved.json()).toMatchObject({
      event: { id: 'tt_aaaa1111', title: 'Showroom visit', updatedBy: 'Hexiang' },
    });
    const all = (await (
      await app.request('/api/timetable', { headers: { cookie: team } })
    ).json()) as {
      events: unknown[];
      people: string[];
    };
    expect(all.events).toHaveLength(1);
    expect(all.people).toEqual(['Jo']);

    const gone = await app.request('/api/timetable/events/tt_aaaa1111', {
      method: 'DELETE',
      headers: { cookie: admin },
    });
    expect(await gone.json()).toEqual({ removed: true });
  });

  it('refuses an appointment that ends before it starts', async () => {
    const app = buildApp({
      timetable: createTimetableStore(mkdtempSync(path.join(tmpdir(), 'tt-'))),
    });
    const admin = cookieOf(
      await app.request('/api/auth/admin', send('POST', { passcode: 'admin' })),
    );
    const res = await app.request(
      '/api/timetable/events/tt_bbbb2222',
      send('PUT', { ...meetUp, start: '15:00', end: '14:00' }, admin),
    );
    expect(res.status).toBe(400);
  });
});
