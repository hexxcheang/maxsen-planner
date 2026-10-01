import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { signedIn } = useAuth();
  const location = useLocation();
  if (!signedIn) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return children;
}
