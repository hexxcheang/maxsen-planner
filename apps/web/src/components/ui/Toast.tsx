import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToastContext, type ToastApi, type ToastTone } from './toast-context';

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const toast = useCallback<ToastApi['toast']>(
    ({ title, body, tone = 'ok' }) => {
      const id = next.current++;
      setItems((all) => [...all.slice(-2), { id, title, body, tone }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-5 bottom-5 z-[var(--z-toast)] flex w-80 flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-popover border border-rule bg-surface px-3 py-2.5 shadow-float animate-[rise-in_var(--dur)_var(--ease)]"
          >
            {t.tone === 'danger' ? (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <CircleCheck
                aria-hidden
                className={cn('mt-0.5 size-4 shrink-0', t.tone === 'ok' ? 'text-ok' : 'text-ink-2')}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-control font-medium text-ink">{t.title}</p>
              {t.body && <p className="text-meta text-ink-2">{t.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="text-ink-3 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
