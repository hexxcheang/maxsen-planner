import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdminContext, AuthContext, type AdminApi, type AuthApi } from './auth-context';
import { AdminUnlockDialog } from './AdminUnlockDialog';

/** Phase A sample passcodes; Phase B checks them on the server (env PLANNER_PASSCODE / ADMIN_PASSCODE). */
const TEAM_PASSCODE = 'maxsen';
const ADMIN_PASSCODE = 'admin';
const SESSION_KEY = 'maxsen.session';
const ADMIN_KEY = 'maxsen.admin';
const EXCLUSIVE_KEY = 'maxsen.exclusive';
/** Kept on a device only while the exclusive admin is unlocked there. */
const TEAM_CACHE = 'maxsen.team.cache';

/** The team's details leave this device when the exclusive admin locks or signs out. */
function forgetTeam() {
  try {
    window.localStorage.removeItem(TEAM_CACHE);
  } catch {
    // Nothing kept.
  }
}

function read(storage: () => Storage, key: string): boolean {
  try {
    return storage().getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(storage: () => Storage, key: string, on: boolean) {
  try {
    if (on) storage().setItem(key, '1');
    else storage().removeItem(key);
  } catch {
    // Storage unavailable (private mode): the session simply doesn't persist.
  }
}

/**
 * Signs in on the server, which checks the passcode once the app is online (and lets the paid
 * Claude and Gemini features answer). `open` when the server doesn't check one (on your own
 * computer), `unavailable` when there's no server.
 */
async function serverSignIn(passcode: string): Promise<'ok' | 'wrong' | 'open' | 'unavailable'> {
  let res: Response;
  try {
    res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
  } catch {
    return 'unavailable';
  }
  await throwIfPaused(res);
  try {
    if (res.status === 401) return 'wrong';
    if (!res.ok) return 'unavailable';
    const body = (await res.json()) as { required?: boolean };
    return body.required ? 'ok' : 'open';
  } catch {
    return 'unavailable';
  }
}

/**
 * Too many wrong passcodes from here: the server pauses tries for a while. The app says so (and
 * doesn't fall back to the offline passcode).
 */
export class PausedError extends Error {}

async function throwIfPaused(res: Response) {
  if (res.status !== 429) return;
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new PausedError(body?.message ?? 'Too many wrong passcodes. Try again in a while.');
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function AuthProvider({
  children,
  initialSignedIn,
}: {
  children: ReactNode;
  initialSignedIn?: boolean;
}) {
  const [signedIn, setSignedIn] = useState(() => initialSignedIn ?? read(local, SESSION_KEY));
  const [unlocked, setUnlocked] = useState(() => read(session, ADMIN_KEY));
  const [exclusive, setExclusive] = useState(() => read(session, EXCLUSIVE_KEY));
  const [exclusiveReady, setExclusiveReady] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState<{ action?: string; exclusive?: boolean } | null>(null);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const signIn = useCallback(async (passcode: string) => {
    const server = await serverSignIn(passcode);
    // Online the server's passcode decides; on your own computer, the team passcode.
    const ok = server === 'ok' || (server !== 'wrong' && passcode.trim() === TEAM_PASSCODE);
    if (ok) {
      write(local, SESSION_KEY, true);
      setSignedIn(true);
    }
    return ok;
  }, []);

  // Online, a session the server no longer accepts (expired, or the passcode changed) signs out.
  useEffect(() => {
    if (!signedIn || initialSignedIn !== undefined) return;
    let live = true;
    fetch('/api/auth/status')
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{
              required: boolean;
              signedIn: boolean;
              exclusive?: boolean;
              exclusiveReady?: boolean;
            }>)
          : null,
      )
      .then((s) => {
        if (live && s?.required && !s.signedIn) {
          write(local, SESSION_KEY, false);
          setSignedIn(false);
        }
        if (live && typeof s?.exclusiveReady === 'boolean') setExclusiveReady(s.exclusiveReady);
        // The exclusive admin's unlock ran out (or was locked elsewhere): the team goes too.
        if (live && s && s.exclusive === false && read(session, EXCLUSIVE_KEY)) {
          write(session, EXCLUSIVE_KEY, false);
          setExclusive(false);
          forgetTeam();
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn, initialSignedIn]);

  const signOut = useCallback(() => {
    void fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => undefined);
    write(local, SESSION_KEY, false);
    write(session, ADMIN_KEY, false);
    write(session, EXCLUSIVE_KEY, false);
    forgetTeam();
    setSignedIn(false);
    setUnlocked(false);
    setExclusive(false);
  }, []);

  const unlock = useCallback(async (passcode: string) => {
    // The server checks it where there is one (so the admin's changes to shared things, like
    // the timetable, are accepted); without a server, the local passcode.
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    if (res) await throwIfPaused(res);
    const server = !res
      ? 'unavailable'
      : res.ok
        ? 'ok'
        : res.status === 401
          ? 'wrong'
          : 'unavailable';
    const ok = server === 'ok' || (server === 'unavailable' && passcode.trim() === ADMIN_PASSCODE);
    if (!ok) return null;
    // Only the server unlocks the exclusive admin: its passcode never lives in the app.
    const isExclusive =
      server === 'ok' &&
      ((await res!.json().catch(() => null)) as { exclusive?: boolean } | null)?.exclusive === true;
    write(session, ADMIN_KEY, true);
    write(session, EXCLUSIVE_KEY, isExclusive);
    if (!isExclusive) forgetTeam();
    setUnlocked(true);
    setExclusive(isExclusive);
    return isExclusive ? 'exclusive' : 'admin';
  }, []);

  const lock = useCallback(() => {
    void fetch('/api/auth/admin/lock', { method: 'POST' }).catch(() => undefined);
    write(session, ADMIN_KEY, false);
    write(session, EXCLUSIVE_KEY, false);
    forgetTeam();
    setUnlocked(false);
    setExclusive(false);
  }, []);

  const requireAdmin = useCallback(
    (action?: string) => {
      if (unlocked) return Promise.resolve(true);
      pending.current?.(false);
      setPrompt({ action });
      return new Promise<boolean>((resolve) => {
        pending.current = resolve;
      });
    },
    [unlocked],
  );

  const requireExclusive = useCallback(
    (action?: string) => {
      if (exclusive) return Promise.resolve(true);
      pending.current?.(false);
      setPrompt({ action, exclusive: true });
      return new Promise<boolean>((resolve) => {
        pending.current = resolve;
      });
    },
    [exclusive],
  );

  const settle = (ok: boolean) => {
    pending.current?.(ok);
    pending.current = null;
    setPrompt(null);
  };

  const auth = useMemo<AuthApi>(() => ({ signedIn, signIn, signOut }), [signedIn, signIn, signOut]);
  const admin = useMemo<AdminApi>(
    () => ({ unlocked, exclusive, exclusiveReady, unlock, lock, requireAdmin, requireExclusive }),
    [unlocked, exclusive, exclusiveReady, unlock, lock, requireAdmin, requireExclusive],
  );

  return (
    <AuthContext.Provider value={auth}>
      <AdminContext.Provider value={admin}>
        {children}
        <AdminUnlockDialog
          open={prompt !== null}
          action={prompt?.action}
          exclusive={prompt?.exclusive}
          onUnlock={unlock}
          onDone={settle}
        />
      </AdminContext.Provider>
    </AuthContext.Provider>
  );
}
