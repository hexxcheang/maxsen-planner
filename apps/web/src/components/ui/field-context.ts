import { createContext, useContext } from 'react';

export interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Inputs inside a Field pick up its id, description and invalid state from here. */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}
