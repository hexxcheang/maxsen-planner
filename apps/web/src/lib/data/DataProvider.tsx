import type { ReactNode } from 'react';
import type { SampleStore } from './sample-store';
import { StoreContext } from './store-context';

export function DataProvider({
  store,
  loading = false,
  children,
}: {
  store: SampleStore;
  /** Simulates the first fetch so loading states can be reviewed (`?sample=loading`). */
  loading?: boolean;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={{ store, loading }}>{children}</StoreContext.Provider>;
}
