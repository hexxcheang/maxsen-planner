import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 border-t border-b border-rule py-12 pl-1',
        className,
      )}
    >
      {icon && (
        <span className="flex size-10 items-center justify-center rounded-popover border border-rule bg-surface text-ink-2 [&_svg]:size-5">
          {icon}
        </span>
      )}
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-section text-ink">{title}</h2>
        {body && <p className="text-body text-ink-2">{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
