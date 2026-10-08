import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createLeadStore } from './leads.ts';

const send = (method: string, body: unknown, name = 'Jo', cookie = '') => ({
  method,
  headers: { 'content-type': 'application/json', 'x-maxsen-name': name, cookie },
  body: JSON.stringify(body),
});
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
type Out = { lead: { updatedAt: string; updatedBy: string; status: string; notes: unknown[] } };

describe('leads', () => {
  const fresh = () =>
    buildApp({ leads: createLeadStore(mkdtempSync(path.join(tmpdir(), 'leads-'))) });
  const url = '/api/leads/ld_aaaa1111';

  it('anyone adds and updates; a stale edit is caught; notes always add up', async () => {
    const app = fresh();
    const made = (await (
      await app.request(url, send('PUT', { name: 'Mr Tan', phone: '91234567', status: 'new' }))
    ).json()) as Out;
    expect(made.lead.updatedBy).toBe('Jo');

    // Sam moves it on, from the version both of them had.
    const base = made.lead.updatedAt;
    const sam = await app.request(
      url,
      send('PUT', { name: 'Mr Tan', status: 'contacted', baseUpdatedAt: base }, 'Sam'),
    );
    expect(sam.status).toBe(200);
    // Jo's edit, from the old version, doesn't undo Sam's.
    const stale = await app.request(
      url,
      send('PUT', { name: 'Mr Tan', status: 'quoted', baseUpdatedAt: base }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ lead: { status: 'contacted', updatedBy: 'Sam' } });

    // Notes from two people both land.
    await app.request(`${url}/notes`, send('POST', { text: 'Called, wants a showroom visit' }));
    await app.request(`${url}/notes`, send('POST', { text: 'Sent the brochure' }, 'Sam'));
    const all = (await (await app.request('/api/leads')).json()) as {
      leads: { notes: { by: string }[] }[];
    };
    expect(all.leads[0]!.notes.map((n) => n.by)).toEqual(['Jo', 'Sam']);
  });

  it('only the admin deletes a lead', async () => {
    const app = fresh();
    await app.request(url, send('PUT', { name: 'Mr Lee', status: 'new' }));
    expect((await app.request(url, { method: 'DELETE' })).status).toBe(403);
    const admin = cookieOf(
      await app.request('/api/auth/admin', send('POST', { passcode: 'admin' })),
    );
    const res = await app.request(url, { method: 'DELETE', headers: { cookie: admin } });
    expect(await res.json()).toEqual({ removed: true });
  });
});
