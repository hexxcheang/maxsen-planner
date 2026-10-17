import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A flat region divided from its neighbours by hairline rules; never a floating card. */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('bg-surface', className)} {...rest} />;
}

export function SectionTitle({
  children,
  actions,
  className,
  as: Tag = 'h2',
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <Tag className="text-section text-ink">{children}</Tag>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-chip border border-rule-2 bg-surface px-1 font-sans text-caption text-ink-2">
      {children}
    </kbd>
  );
}
