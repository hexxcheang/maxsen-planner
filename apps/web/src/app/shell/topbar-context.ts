import { createContext } from 'react';

export type TopBarSlotName = 'left' | 'center' | 'right';
export type TopBarTargets = Record<TopBarSlotName, HTMLElement | null>;

export const TopBarContext = createContext<TopBarTargets>({
  left: null,
  center: null,
  right: null,
});
