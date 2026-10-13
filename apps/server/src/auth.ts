/**
 * The team passcode, checked on the server once the app is online: signing in with it sets a
 * signed cookie, and the API (Claude and Gemini, which cost money per use) answers only with that
 * cookie. With no PLANNER_PASSCODE set (running on your own Mac) the API stays open as before.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

const COOKIE = 'maxsen_session';
const ADMIN_COOKIE = 'maxsen_admin';
const EXCLUSIVE_COOKIE = 'maxsen_exclusive';
/** Admin stays unlocked for a working day. */
const ADMIN_MAX_AGE = 60 * 60 * 12;
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days, like staying signed in on a work tablet

export interface AuthConfig {
  passcode?: string;
  /** Unlocks admin (scheduling the timetable); "admin" when not set, as on your own computer. */
  adminPasscode?: string;
  /**
   * The exclusive admin (the owner): everything the admin can do, plus the Team tab with
   * everyone's details. Not set: nobody can unlock it, so the team stays private.
   */
  exclusivePasscode?: string;
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

export function createAuth({ passcode, adminPasscode, exclusivePasscode, secret }: AuthConfig) {
  const key = secret || sign('maxsen-planner', passcode ?? '');
  const admin = adminPasscode?.trim() || 'admin';
  const exclusive = exclusivePasscode?.trim() || null;
  const token = (scope = '') => {
    const issued = Date.now().toString(36);
    return `${issued}.${sign(key, scope + issued)}`;
  };
  const valid = (t: string | undefined, scope = '', maxAge = MAX_AGE) => {
    if (!t) return false;
    const [issued, mac] = t.split('.');
    if (!issued || !mac || !same(mac, sign(key, scope + issued))) return false;
    return Date.now() - parseInt(issued, 36) < maxAge * 1000;
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
      setCookie(c, ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
      setCookie(c, EXCLUSIVE_COOKIE, '', { path: '/', maxAge: 0 });
    },
    /** Whether an exclusive admin passcode is set on this server. */
    exclusiveSet: Boolean(exclusive),
    /** Whether this browser has unlocked admin (checked on the server, not just in the app). */
    isAdmin: (c: Context) => valid(getCookie(c, ADMIN_COOKIE), 'admin:', ADMIN_MAX_AGE),
    /** Whether this browser has unlocked the exclusive admin (checked on the server). */
    isExclusive: (c: Context) =>
      Boolean(exclusive) && valid(getCookie(c, EXCLUSIVE_COOKIE), 'exclusive:', ADMIN_MAX_AGE),
    /**
     * Checks an admin passcode and, if right, unlocks it for the day: `exclusive` (which also
     * unlocks admin), `admin`, or null when it's neither.
     */
    unlockAdmin(c: Context, attempt: string): 'exclusive' | 'admin' | null {
      const tried = attempt.trim();
      const level =
        exclusive && same(tried, exclusive) ? 'exclusive' : same(tried, admin) ? 'admin' : null;
      if (!level) return null;
      const cookie = {
        httpOnly: true,
        secure: new URL(c.req.url).protocol === 'https:',
        sameSite: 'Lax',
        path: '/',
        maxAge: ADMIN_MAX_AGE,
      } as const;
      setCookie(c, ADMIN_COOKIE, token('admin:'), cookie);
      if (level === 'exclusive') setCookie(c, EXCLUSIVE_COOKIE, token('exclusive:'), cookie);
      else setCookie(c, EXCLUSIVE_COOKIE, '', { path: '/', maxAge: 0 });
      return level;
    },
    lockAdmin(c: Context) {
      setCookie(c, ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
      setCookie(c, EXCLUSIVE_COOKIE, '', { path: '/', maxAge: 0 });
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
