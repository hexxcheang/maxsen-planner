import { createContext, useContext } from 'react';

export interface AuthApi {
  signedIn: boolean;
  signIn: (passcode: string) => Promise<boolean>;
  signOut: () => void;
}

export interface AdminApi {
  unlocked: boolean;
  unlock: (passcode: string) => Promise<boolean>;
  lock: () => void;
  /** Resolves true once admin is unlocked, opening the unlock dialog if needed. */
  requireAdmin: (action?: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthApi | null>(null);
export const AdminContext = createContext<AdminApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useAdmin(): AdminApi {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AuthProvider>');
  return ctx;
}
