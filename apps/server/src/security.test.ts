import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { createLeadStore } from './leads.ts';
import { createSharedStore } from './shared/store.ts';

const lead = (headers: Record<string, string> = {}) => ({
  method: 'PUT',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({ name: 'Mr Tan', status: 'new' }),
});

describe('protection from other websites', () => {
  const app = buildApp({ leads: createLeadStore(mkdtempSync(path.join(tmpdir(), 'sec-'))) });

  it('refuses changes sent from another site, and takes the app’s own', async () => {
    const cross = await app.request(
      '/api/leads/ld_test1',
      lead({ 'sec-fetch-site': 'cross-site' }),
    );
    expect(cross.status).toBe(403);
    const sibling = await app.request(
      '/api/leads/ld_test1',
      lead({ 'sec-fetch-site': 'same-site' }),
    );
    expect(sibling.status).toBe(403);
    // An older browser without Sec-Fetch-Site: the Origin must be this server.
    const elsewhere = await app.request(
      'http://planner.test/api/leads/ld_test1',
      lead({ origin: 'https://evil.example', host: 'planner.test' }),
    );
    expect(elsewhere.status).toBe(403);
    const own = await app.request('/api/leads/ld_test1', lead({ 'sec-fetch-site': 'same-origin' }));
    expect(own.status).toBe(200);
    const ownOrigin = await app.request(
      'http://planner.test/api/leads/ld_test2',
      lead({ origin: 'http://planner.test', host: 'planner.test' }),
    );
    expect(ownOrigin.status).toBe(200);
    // Reading isn't a change.
    expect(
      (await app.request('/api/leads', { headers: { 'sec-fetch-site': 'cross-site' } })).status,
    ).toBe(200);
  });

  it('never lets another site read the API (no CORS)', async () => {
    const res = await app.request('/api/leads', { headers: { origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await app.request('/api/leads', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'PUT' },
    });
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sends security headers: no framing by other sites, no type sniffing', async () => {
    const res = await app.request('/api/health');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
});

describe('passcode guessing', () => {
  const json = (passcode: string) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify({ passcode }),
  });

  it('pauses after 10 wrong passcodes from one place, even for the right one', async () => {
    const app = buildApp({ auth: createAuth({ passcode: 'tampines' }) });
    for (let i = 0; i < 10; i++)
      expect((await app.request('/api/auth/sign-in', json(`guess${i}`))).status).toBe(401);
    const paused = await app.request('/api/auth/sign-in', json('tampines'));
    expect(paused.status).toBe(429);
    expect(((await paused.json()) as { message: string }).message).toMatch(/Try again in \d+/);
    // Someone else, elsewhere, isn't held up.
    const other = await app.request('/api/auth/sign-in', {
      ...json('tampines'),
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
    });
    expect(other.status).toBe(200);
  });
});

describe('stored files', () => {
  it('serves a file uploaded as a web page as a plain download, never run as a page', async () => {
    const app = buildApp({ shared: createSharedStore(mkdtempSync(path.join(tmpdir(), 'sec-'))) });
    const put = await app.request('/api/shared/files/file_evil1', {
      method: 'PUT',
      headers: { 'content-type': 'text/html' },
      body: '<script>alert(1)</script>',
    });
    expect(put.status).toBe(200);
    const res = await app.request('/api/shared/files/file_evil1');
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    await app.request('/api/shared/files/file_img01', {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([137, 80, 78, 71]),
    });
    expect((await app.request('/api/shared/files/file_img01')).headers.get('content-type')).toBe(
      'image/png',
    );
  });
});
