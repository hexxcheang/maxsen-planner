import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui';
import { DataProvider } from '@/lib/data/DataProvider';
import { createSampleStore, type SampleStore } from '@/lib/data/sample-store';
import { AuthProvider } from './auth/AuthProvider';

/**
 * Review hooks for the static prototype: `?sample=empty` starts with no data, `?sample=loading`
 * shows every screen's loading state.
 */
function sampleModeFromUrl(): { seed: 'sample' | 'empty'; loading: boolean } {
  const mode = new URLSearchParams(window.location.search).get('sample');
  return { seed: mode === 'empty' ? 'empty' : 'sample', loading: mode === 'loading' };
}

interface ProvidersProps {
  children: ReactNode;
  store?: SampleStore;
  signedIn?: boolean;
}

export function Providers({ children, store: given, signedIn }: ProvidersProps) {
  const [{ store, loading }] = useState(() => {
    if (given) return { store: given, loading: false };
    const mode = sampleModeFromUrl();
    return { store: createSampleStore(mode.seed), loading: mode.loading };
  });
  return (
    <DataProvider store={store} loading={loading}>
      <AuthProvider initialSignedIn={signedIn}>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </DataProvider>
  );
}
