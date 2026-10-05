/**
 * The team passcode, checked on the server once the app is online: signing in with it sets a
 * signed cookie, and the API (Claude and Gemini, which cost money per use) answers only with that
 * cookie. With no PLANNER_PASSCODE set (running on your own Mac) the API stays open as before.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

const COOKIE = 'maxsen_session';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days, like staying signed in on a work tablet

export interface AuthConfig {
  passcode?: string;
  /** Signs the session cookie; defaults to one derived from the passcode. */
  secret?: string;
}

const sign = (secret: string, value: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function createAuth({ passcode, secret }: AuthConfig) {
  const key = secret || (passcode ? sign('maxsen-planner', passcode) : '');
  const token = () => {
    const issued = Date.now().toString(36);
    return `${issued}.${sign(key, issued)}`;
  };
  const valid = (t: string | undefined) => {
    if (!t) return false;
    const [issued, mac] = t.split('.');
    if (!issued || !mac || !same(mac, sign(key, issued))) return false;
    return Date.now() - parseInt(issued, 36) < MAX_AGE * 1000;
  };
  const signedIn = (c: Context) => !passcode || valid(getCookie(c, COOKIE));

  return {
    required: Boolean(passcode),
    signedIn,
    /** Checks a passcode and, if right, starts a session. */
    signIn(c: Context, attempt: string) {
      if (!passcode) return true;
      if (!same(attempt.trim(), passcode)) return false;
      setCookie(c, COOKIE, token(), {
        httpOnly: true,
        secure: new URL(c.req.url).protocol === 'https:',
        sameSite: 'Lax',
        path: '/',
        maxAge: MAX_AGE,
      });
      return true;
    },
    signOut(c: Context) {
      setCookie(c, COOKIE, '', { path: '/', maxAge: 0 });
    },
    /** Guards the API, apart from the health check and signing in. */
    guard: (): MiddlewareHandler => async (c, next) => {
      const path = c.req.path;
      if (path === '/api/health' || path.startsWith('/api/auth/') || signedIn(c)) return next();
      return c.json({ error: 'signed-out', message: 'Sign in again to use this.' }, 401);
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;
