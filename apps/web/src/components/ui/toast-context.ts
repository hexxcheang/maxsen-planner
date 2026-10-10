import { createContext, useContext } from 'react';

export type ToastTone = 'ok' | 'danger' | 'neutral';

export interface ToastApi {
  toast: (t: { title: string; body?: string; tone?: ToastTone }) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
