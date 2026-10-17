import { createContext, useContext } from 'react';
import type { PlannerStore } from './store/plannerStore';

export interface PlannerContextValue {
  store: PlannerStore;
  /** Records that a variant was placed or chosen (snapshot + recently used). */
  recordUse: (variantId: string) => void;
}

export const PlannerContext = createContext<PlannerContextValue | null>(null);

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside the planner');
  return ctx;
}
