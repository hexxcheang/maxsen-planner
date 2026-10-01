import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';
import { TopBarContext, type TopBarTargets } from './topbar-context';

export function AppShell() {
  const [targets, setTargets] = useState<TopBarTargets>({ left: null, center: null, right: null });
  // Stable callback refs: a new function each render would detach and reattach on every update.
  const refs = useMemo(() => {
    const make = (slot: keyof TopBarTargets) => (el: HTMLElement | null) =>
      setTargets((t) => (t[slot] === el ? t : { ...t, [slot]: el }));
    return { left: make('left'), center: make('center'), right: make('right') };
  }, []);

  return (
    <TopBarContext.Provider value={targets}>
      <div id="app-shell" className="flex h-dvh overflow-hidden bg-paper">
        <NavRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar leftRef={refs.left} centerRef={refs.center} rightRef={refs.right} />
          <main id="main" className="relative min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TopBarContext.Provider>
  );
}
