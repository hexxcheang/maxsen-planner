import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { createAuth } from '../auth.ts';
import { createSharedStore } from './store.ts';

const fresh = () =>
  buildApp({ shared: createSharedStore(mkdtempSync(path.join(tmpdir(), 'shared-'))) });

const put = (body: unknown) => ({
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const bundle = (title: string) => ({
  project: {
    id: 'proj_abc123XYZ',
    title,
    customerName: 'Mr Lim',
    propertyAddress: '1 Tampines',
    status: 'draft',
  },
  plans: [{ id: 'plan_1' }],
});

describe('projects saved for the team', () => {
  it('saves a project, lists it and gives it back', async () => {
    const app = fresh();
    const saved = await app.request(
      '/api/shared/projects/proj_abc123XYZ',
      put({ baseVersion: 0, savedBy: 'Jo', bundle: bundle('Lim home') }),
    );
    expect(saved.status).toBe(200);
    const { meta } = (await saved.json()) as { meta: { version: number; savedBy: string } };
    expect(meta).toMatchObject({ version: 1, savedBy: 'Jo' });

    const list = (await (await app.request('/api/shared/projects')).json()) as {
      projects: { id: string; title: string }[];
    };
    expect(list.projects).toMatchObject([{ id: 'proj_abc123XYZ', title: 'Lim home' }]);

    const got = (await (await app.request('/api/shared/projects/proj_abc123XYZ')).json()) as {
      bundle: { plans: unknown[] };
    };
    expect(got.bundle.plans).toHaveLength(1);
  });

  it('refuses a save over a newer one unless forced', async () => {
    const app = fresh();
    const url = '/api/shared/projects/proj_abc123XYZ';
    await app.request(url, put({ baseVersion: 0, savedBy: 'Jo', bundle: bundle('A') }));
    await app.request(url, put({ baseVersion: 1, savedBy: 'Sam', bundle: bundle('B') }));
    // Jo still has version 1.
    const stale = await app.request(
      url,
      put({ baseVersion: 1, savedBy: 'Jo', bundle: bundle('C') }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ meta: { version: 2, savedBy: 'Sam' } });
    const forced = await app.request(
      url,
      put({ baseVersion: 1, savedBy: 'Jo', bundle: bundle('C'), force: true }),
    );
    expect(await forced.json()).toMatchObject({ meta: { version: 3, title: 'C' } });
  });

  it('keeps drawings, and says which are missing', async () => {
    const app = fresh();
    const missing = (ids: string[]) =>
      app.request('/api/shared/files/missing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    expect(await (await missing(['file_aaaa1111', '../etc'])).json()).toEqual({
      missing: ['file_aaaa1111'],
    });
    const up = await app.request('/api/shared/files/file_aaaa1111', {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(up.status).toBe(200);
    expect(await (await missing(['file_aaaa1111'])).json()).toEqual({ missing: [] });
    const down = await app.request('/api/shared/files/file_aaaa1111');
    expect(down.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await down.arrayBuffer())]).toEqual([1, 2, 3]);
    expect((await app.request('/api/shared/files/..%2Fsecret')).status).toBe(404);
  });

  it('rejects a project whose id does not match the address', async () => {
    const app = fresh();
    const res = await app.request(
      '/api/shared/projects/proj_other1234',
      put({ baseVersion: 0, savedBy: 'Jo', bundle: bundle('A') }),
    );
    expect(res.status).toBe(400);
  });

  it('is closed until signed in online', async () => {
    const app = buildApp({
      auth: createAuth({ passcode: 'tampines' }),
      shared: createSharedStore(mkdtempSync(path.join(tmpdir(), 'shared-'))),
    });
    expect((await app.request('/api/shared/projects')).status).toBe(401);
  });
});
