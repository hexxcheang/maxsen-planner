/**
 * Protection against other websites and guessing, on top of the signed-in cookie:
 *
 * - No CORS: the server never sends Access-Control-Allow-Origin, so a page on another site can't
 *   read anything from the API; browsers keep each site's data to itself by default.
 * - Changes only from the app itself: a request to change something (POST, PUT, DELETE) that a
 *   browser marks as coming from another site is refused, so a page elsewhere can't act with a
 *   team member's sign-in ("cross-site request forgery"). The SameSite cookie already stops most.
 * - Security headers: the app can't be shown inside another site's frame (to trick clicks), files
 *   aren't second-guessed as another type, and nothing is told where links were clicked from.
 * - Passcode guessing is slowed: after too many wrong tries from one place, a pause.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Refuses changes sent from another website. */
export const sameSiteOnly = (): MiddlewareHandler => async (c, next) => {
  if (SAFE.has(c.req.method)) return next();
  // Browsers say where a request comes from; only the app's own pages may change things.
  const site = c.req.header('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return refuse(c);
  // Older browsers send no Sec-Fetch-Site: then the Origin must be this server's own.
  const origin = c.req.header('origin');
  if (!site && origin && origin !== 'null') {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return refuse(c);
    }
    const own = [c.req.header('host'), c.req.header('x-forwarded-host')].filter(Boolean);
    if (!own.includes(host)) return refuse(c);
  }
  return next();
};

const refuse = (c: Context) =>
  c.json(
    { error: 'cross-site', message: 'Changes can only be made from the planner itself.' },
    403,
  );

const common = {
  // Not shown inside another site's frame (clickjacking).
  xFrameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
  // Over https (Render), browsers keep to https for a year.
  strictTransportSecurity: 'max-age=31536000',
} as const;

const pageHeaders = secureHeaders({
  ...common,
  contentSecurityPolicy: {
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    formAction: ["'self'"],
  },
});

/** A stored file (a drawing, a picture) is never run as a page, even if someone uploaded one. */
const fileHeadersOnly = secureHeaders({
  ...common,
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    imgSrc: ["'self'"],
    styleSrc: ["'unsafe-inline'"],
    frameAncestors: ["'none'"],
    sandbox: [],
  },
});

/**
 * A receipt: only ever a picture or a PDF (anything else is sent as a plain download), opened in
 * its own tab or shown in the app's own frame. Not sandboxed, or browsers won't show the PDF;
 * a picture or PDF can't run as a page.
 */
const receiptHeaders = secureHeaders({
  ...common,
  xFrameOptions: 'SAMEORIGIN',
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    imgSrc: ["'self'"],
    styleSrc: ["'unsafe-inline'"],
    frameAncestors: ["'self'"],
  },
});

/** Headers for every page, API answer and stored file. */
export const headers = (): MiddlewareHandler => (c, next) =>
  c.req.path.startsWith('/api/shared/files/')
    ? fileHeadersOnly(c, next)
    : c.req.path.startsWith('/api/claims/receipts/')
      ? receiptHeaders(c, next)
      : pageHeaders(c, next);

/** The visitor's address: Render puts the real one in front (behind Cloudflare). */
function clientOf(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('true-client-ip') ??
    c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() ??
    'local'
  );
}

/**
 * Slows passcode guessing: after `max` wrong tries from one address within `windowMs`, further
 * tries are refused until the window has passed. A right passcode clears the count.
 */
export function createAttemptLimit({ max = 10, windowMs = 15 * 60_000 } = {}) {
  const tries = new Map<string, { count: number; since: number }>();
  const entry = (c: Context) => {
    const key = clientOf(c);
    const now = Date.now();
    const e = tries.get(key);
    if (!e || now - e.since > windowMs) {
      const fresh = { count: 0, since: now };
      tries.set(key, fresh);
      return { key, e: fresh };
    }
    return { key, e };
  };
  return {
    /** Minutes to wait, when this address has used up its tries; else 0. */
    blocked(c: Context): number {
      const { e } = entry(c);
      return e.count >= max ? Math.ceil((e.since + windowMs - Date.now()) / 60_000) : 0;
    },
    failed(c: Context) {
      entry(c).e.count++;
      // Old entries go, so the map doesn't grow without end.
      if (tries.size > 5000)
        for (const [k, v] of tries) if (Date.now() - v.since > windowMs) tries.delete(k);
    },
    succeeded(c: Context) {
      tries.delete(clientOf(c));
    },
  };
}

/** File types served back as they are; anything else is sent as a plain download. */
const SERVABLE = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i;

/** A stored file's type, served as it is only when it's a picture or a PDF. */
export function fileHeaders(type: string): Record<string, string> {
  return {
    'content-type': SERVABLE.test(type) ? type : 'application/octet-stream',
    'cache-control': 'private, max-age=31536000, immutable',
  };
}
