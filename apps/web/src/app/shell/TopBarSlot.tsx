import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TopBarContext, type TopBarSlotName } from './topbar-context';

/** Renders context controls (breadcrumb, sub-nav, save state) into the shell's top bar. */
export function TopBarSlot({ slot, children }: { slot: TopBarSlotName; children: ReactNode }) {
  const target = useContext(TopBarContext)[slot];
  return target ? createPortal(children, target) : null;
}
