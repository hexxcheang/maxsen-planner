import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createInventoryStore } from './inventory.ts';

const post = (body: unknown, cookie = '') => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie, 'x-maxsen-name': 'Ali' },
  body: JSON.stringify(body),
});
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
const sw = (qty: number) => ({ variantId: 'var_sw', name: 'Nova+ Pro, 2-gang', qty });

describe('inventory', () => {
  const fresh = () =>
    buildApp({ inventory: createInventoryStore(mkdtempSync(path.join(tmpdir(), 'inv-'))) });

  it('installers take out for a site; only the manager restocks and checks', async () => {
    const app = fresh();
    // Restocking is the manager's.
    expect(
      (await app.request('/api/inventory/movements', post({ kind: 'restock', lines: [sw(20)] })))
        .status,
    ).toBe(403);
    const admin = cookieOf(await app.request('/api/auth/admin', post({ passcode: 'admin' })));
    expect(
      (
        await app.request(
          '/api/inventory/movements',
          post({ kind: 'restock', lines: [sw(20)] }, admin),
        )
      ).status,
    ).toBe(200);

    // Any installer takes out, for a named site.
    expect(
      (await app.request('/api/inventory/movements', post({ kind: 'checkout', lines: [sw(5)] })))
        .status,
    ).toBe(400);
    const out = (await (
      await app.request(
        '/api/inventory/movements',
        post({ kind: 'checkout', site: 'Tan residence', lines: [sw(5)] }),
      )
    ).json()) as { movement: { id: string; by: string } };
    expect(out.movement.by).toBe('Ali');

    // Checking it is the manager's.
    const url = `/api/inventory/movements/${out.movement.id}/verify`;
    expect((await app.request(url, post({ counts: { var_sw: 6 } }))).status).toBe(403);
    const checked = await app.request(url, post({ counts: { var_sw: 6 } }, admin));
    expect(await checked.json()).toMatchObject({
      movement: { verified: { counts: { var_sw: 6 } } },
    });

    const all = (await (await app.request('/api/inventory')).json()) as { movements: unknown[] };
    expect(all.movements).toHaveLength(2);
  });

  it('refuses nothing-quantities', async () => {
    const app = fresh();
    const res = await app.request(
      '/api/inventory/movements',
      post({ kind: 'return', site: 'x', lines: [sw(0)] }),
    );
    expect(res.status).toBe(400);
  });
});
