import { describe, expect, it } from 'vitest';
import { app } from './index.ts';

describe('server', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('answers a built file from an older version with not found, not the app page', async () => {
    const res = await app.request('/assets/pdf-OLDVERSION.js');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).not.toMatch(/html/);
  });
});
