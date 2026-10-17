import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { createLeadStore } from './leads.ts';
import { topicOf } from './live.ts';
import { createTeamStore } from './team.ts';
import { createTimetableStore } from './timetable.ts';

const post = (body: unknown, cookie = '') => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-maxsen-name': 'Jo', cookie },
  body: JSON.stringify(body),
});
const at = '2026-10-01T00:00:00.000Z';
const lead = {
  id: 'ld_abcdef12',
  name: 'Mrs Tan',
  status: 'quoted',
  notes: [{ at, by: 'Jo', text: 'Wants smart lights' }],
  createdAt: at,
  createdBy: 'Jo',
  updatedAt: at,
  updatedBy: 'Jo',
};
const event = {
  id: 'ev_abcdef12',
  kind: 'installation',
  date: '2026-10-20',
  start: '09:00',
  end: '12:00',
  title: 'Install',
  people: ['Sam'],
  updatedAt: at,
  updatedBy: 'Boss',
};

describe('putting data back after the server lost it', () => {
  const setup = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'restore-'));
    return buildApp({
      auth: createAuth({ exclusivePasscode: 'owner-pass' }),
      leads: createLeadStore(dir),
      timetable: createTimetableStore(dir),
      team: createTeamStore(dir),
    });
  };

  it('takes a device’s copy only while the server has none', async () => {
    const app = setup();
    expect(await (await app.request('/api/leads')).json()).toEqual({ leads: [], fresh: true });
    const first = await app.request('/api/leads/restore', post({ leads: [lead] }));
    expect(await first.json()).toEqual({ restored: true });
    expect(await (await app.request('/api/leads')).json()).toMatchObject({
      leads: [{ name: 'Mrs Tan', notes: [{ text: 'Wants smart lights' }] }],
      fresh: false,
    });
    // Another device's older copy never replaces the team's leads.
    const second = await app.request('/api/leads/restore', post({ leads: [] }));
    expect(await second.json()).toEqual({ restored: false });
    expect(((await (await app.request('/api/leads')).json()) as { leads: [] }).leads).toHaveLength(
      1,
    );
  });

  it('puts back the timetable and the team, with the team’s details', async () => {
    const app = setup();
    const unlocked = await app.request('/api/auth/admin', post({ passcode: 'owner-pass' }));
    const cookie = unlocked.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const get = async (url: string) => (await app.request(url, { headers: { cookie } })).json();
    expect(await get('/api/timetable')).toMatchObject({ fresh: true });
    expect(await get('/api/team')).toMatchObject({ fresh: true });
    const restored = await app.request(
      '/api/timetable/restore',
      post({ events: [event], people: ['Sam'], phones: { Sam: '+65 8123 4567' }, notify: true }),
    );
    expect(await restored.json()).toEqual({ restored: true });
    // The team is first copied from the timetable, but a device's team copy still replaces it.
    expect(await get('/api/team')).toMatchObject({
      members: [{ name: 'Sam' }],
      fresh: true,
    });
    const member = { id: 'tm_sam12345', name: 'Sam', role: 'Installer', phone: '+65 8123 4567' };
    const team = await app.request(
      '/api/team/restore',
      post({ members: [{ ...member, active: true, updatedAt: at, updatedBy: 'Boss' }] }, cookie),
    );
    expect(await team.json()).toEqual({ restored: true });
    expect(await get('/api/team')).toMatchObject({
      members: [{ role: 'Installer' }],
      fresh: false,
    });
    expect(await get('/api/timetable')).toMatchObject({
      events: [{ title: 'Install' }],
      people: ['Sam'],
      notify: true,
      fresh: false,
    });
  });

  it('refuses a copy that isn’t one', async () => {
    const app = setup();
    const res = await app.request('/api/leads/restore', post({ leads: [{ name: 'x' }] }));
    expect(res.status).toBe(400);
  });

  it('tells open copies of the app at once when something changes', async () => {
    const app = setup();
    const res = await app.request('/api/live');
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    expect((await reader.read()).value).toContain('event: ready');
    await app.request('/api/leads/ld_newlead1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Mr Lim', status: 'new' }),
    });
    const next = (await reader.read()).value;
    expect(next).toContain('event: changed');
    expect(next).toContain('data: leads');
    await reader.cancel();
  });

  it('names what changed for the live stream', () => {
    expect(topicOf('/api/timetable/events/ev_1')).toBe('timetable');
    expect(topicOf('/api/leads/ld_1/notes')).toBe('leads');
    expect(topicOf('/api/shared/projects/p1')).toBe('projects');
    expect(topicOf('/api/auth/sign-in')).toBeNull();
  });
});
