import { useCallback } from 'react';
import { useAdmin } from './auth-context';

/** Runs `fn` once admin is unlocked, asking for the admin passcode first if needed. */
export function useAdminAction() {
  const { requireAdmin } = useAdmin();
  return useCallback(
    (action: string, fn: () => void) => {
      void requireAdmin(action).then((ok) => {
        if (ok) fn();
      });
    },
    [requireAdmin],
  );
}
