import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brass' | 'ok' | 'warn' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-rule-2 text-ink-2',
  brass: 'border-brass/50 bg-brass-tint text-brass-2',
  ok: 'border-ok/40 text-ok',
  warn: 'border-warn/40 bg-warn-tint text-warn',
  danger: 'border-danger/40 bg-danger-tint text-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-chip border px-1.5 text-caption font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
