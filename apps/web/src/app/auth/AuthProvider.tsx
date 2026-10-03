import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdminContext, AuthContext, type AdminApi, type AuthApi } from './auth-context';
import { AdminUnlockDialog } from './AdminUnlockDialog';

/** Phase A sample passcodes; Phase B checks them on the server (env PLANNER_PASSCODE / ADMIN_PASSCODE). */
const TEAM_PASSCODE = 'maxsen';
const ADMIN_PASSCODE = 'admin';
const SESSION_KEY = 'maxsen.session';
const ADMIN_KEY = 'maxsen.admin';

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
  const [prompt, setPrompt] = useState<{ action?: string } | null>(null);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const signIn = useCallback(async (passcode: string) => {
    const ok = passcode.trim() === TEAM_PASSCODE;
    if (ok) {
      write(local, SESSION_KEY, true);
      setSignedIn(true);
    }
    return Promise.resolve(ok);
  }, []);

  const signOut = useCallback(() => {
    write(local, SESSION_KEY, false);
    write(session, ADMIN_KEY, false);
    setSignedIn(false);
    setUnlocked(false);
  }, []);

  const unlock = useCallback(async (passcode: string) => {
    const ok = passcode.trim() === ADMIN_PASSCODE;
    if (ok) {
      write(session, ADMIN_KEY, true);
      setUnlocked(true);
    }
    return Promise.resolve(ok);
  }, []);

  const lock = useCallback(() => {
    write(session, ADMIN_KEY, false);
    setUnlocked(false);
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

  const settle = (ok: boolean) => {
    pending.current?.(ok);
    pending.current = null;
    setPrompt(null);
  };

  const auth = useMemo<AuthApi>(() => ({ signedIn, signIn, signOut }), [signedIn, signIn, signOut]);
  const admin = useMemo<AdminApi>(
    () => ({ unlocked, unlock, lock, requireAdmin }),
    [unlocked, unlock, lock, requireAdmin],
  );

  return (
    <AuthContext.Provider value={auth}>
      <AdminContext.Provider value={admin}>
        {children}
        <AdminUnlockDialog
          open={prompt !== null}
          action={prompt?.action}
          onUnlock={unlock}
          onDone={settle}
        />
      </AdminContext.Provider>
    </AuthContext.Provider>
  );
}
