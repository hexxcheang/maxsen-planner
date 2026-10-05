import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('sign-in on the server', () => {
  it('leaves the API open on your own computer (no passcode set)', async () => {
    const app = buildApp();
    expect(await (await app.request('/api/auth/status')).json()).toEqual({
      required: false,
      signedIn: true,
    });
    expect((await app.request('/api/product-sample/status')).status).toBe(200);
  });

  it('online, keeps the API closed until signed in with the passcode', async () => {
    const app = buildApp({ auth: createAuth({ passcode: 'tampines' }) });
    expect((await app.request('/api/product-sample/status')).status).toBe(401);
    expect((await app.request('/api/health')).status).toBe(200);

    const wrong = await app.request('/api/auth/sign-in', json({ passcode: 'maxsen' }));
    expect(wrong.status).toBe(401);

    const right = await app.request('/api/auth/sign-in', json({ passcode: 'tampines' }));
    expect(right.status).toBe(200);
    const cookie = right.headers.get('set-cookie')!;
    expect(cookie).toMatch(/maxsen_session=.+HttpOnly/);
    const session = cookie.split(';')[0]!;

    const ok = await app.request('/api/product-sample/status', { headers: { cookie: session } });
    expect(ok.status).toBe(200);
    // A forged cookie doesn't open it.
    const forged = await app.request('/api/product-sample/status', {
      headers: { cookie: 'maxsen_session=abc.def' },
    });
    expect(forged.status).toBe(401);
  });
});
