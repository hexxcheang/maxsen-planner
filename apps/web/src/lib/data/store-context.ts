import { createContext, useContext } from 'react';
import type { SampleStore } from './sample-store';

export const StoreContext = createContext<{ store: SampleStore; loading: boolean } | null>(null);

export function useStoreContext() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('Data hooks must be used inside <DataProvider>');
  return ctx;
}
