import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { appRoutes } from '@/app/router';
import { Providers } from '@/app/providers';
import { createSampleStore, type SampleStore } from '@/lib/data/sample-store';

interface TestAppProps {
  path: string;
  signedIn?: boolean;
  store?: SampleStore;
}

/** The full app on a memory router, for screen-level tests. */
export function TestApp({ path, signedIn, store }: TestAppProps) {
  const [router] = useState(() => createMemoryRouter(appRoutes, { initialEntries: [path] }));
  const [s] = useState(() => store ?? createSampleStore());
  return (
    <Providers store={s} signedIn={signedIn}>
      <RouterProvider router={router} />
    </Providers>
  );
}
