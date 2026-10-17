import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createClaimStore } from './claims.ts';

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

const claim = {
  date: '2026-10-12',
  amount: 42.5,
  purpose: 'Cable ties and trunking for the Tan site',
  category: 'Materials',
  receipts: [{ id: 'rcpt_aaaa1111', name: 'receipt.jpg', type: 'image/jpeg' }],
};

describe('claims', () => {
  const fresh = () =>
    buildApp({ claims: createClaimStore(mkdtempSync(path.join(tmpdir(), 'claims-'))) });
  const url = '/api/claims/cl_aaaa1111';

  it('anyone claims with a receipt; only the admin approves or rejects; decided stays', async () => {
    const app = fresh();
    // The receipt goes up first, then the claim with it.
    const up = await app.request('/api/claims/receipts/rcpt_aaaa1111', {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    });
    expect(up.status).toBe(200);
    const pic = await app.request('/api/claims/receipts/rcpt_aaaa1111');
    expect(pic.headers.get('content-type')).toBe('image/jpeg');

    // A claim needs a receipt.
    expect((await app.request(url, send('PUT', { ...claim, receipts: [] }))).status).toBe(400);
    const made = await app.request(url, send('PUT', claim));
    expect(await made.json()).toMatchObject({ claim: { claimant: 'Jo', status: 'pending' } });
    // Changed while it waits.
    expect((await app.request(url, send('PUT', { ...claim, amount: 45 }))).status).toBe(200);

    // Not by anyone else.
    const decide = (body: unknown, cookie = '') =>
      app.request(`${url}/decision`, send('POST', body, 'Boss', cookie));
    expect((await decide({ status: 'approved' })).status).toBe(403);
    const admin = cookieOf(
      await app.request('/api/auth/admin', send('POST', { passcode: 'admin' })),
    );
    // A rejection says why.
    expect((await decide({ status: 'rejected' }, admin)).status).toBe(400);
    const ok = await decide({ status: 'approved' }, admin);
    expect(await ok.json()).toMatchObject({
      claim: { status: 'approved', decidedBy: 'Boss', amount: 45 },
    });

    // Once decided, it stays as it was, and only the admin can remove it.
    expect((await app.request(url, send('PUT', { ...claim, amount: 99 }))).status).toBe(409);
    expect((await app.request(url, { method: 'DELETE' })).status).toBe(403);
    const gone = await app.request(url, { method: 'DELETE', headers: { cookie: admin } });
    expect(await gone.json()).toEqual({ removed: true });
    expect((await app.request('/api/claims/receipts/rcpt_aaaa1111')).status).toBe(404);
  });

  it('takes only pictures and PDFs as receipts', async () => {
    const app = fresh();
    const page = await app.request('/api/claims/receipts/rcpt_bbbb2222', {
      method: 'PUT',
      headers: { 'content-type': 'text/html' },
      body: '<script>alert(1)</script>',
    });
    expect(page.status).toBe(400);
  });
});
