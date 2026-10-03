import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface LibrarySectionProps {
  title: ReactNode;
  count?: number;
  icon?: ReactNode;
  categoryId?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function LibrarySection({
  title,
  count,
  icon,
  categoryId,
  defaultOpen = false,
  children,
}: LibrarySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-rule">
      <button
        type="button"
        aria-expanded={open}
        data-category={categoryId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-paper"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-ink-3 transition-transform duration-[var(--dur)]',
            open && 'rotate-90',
          )}
        />
        {icon}
        <span className="min-w-0 flex-1 truncate text-control font-medium text-ink">{title}</span>
        {count !== undefined && <span className="tnum text-meta text-ink-3">{count}</span>}
      </button>
      {open && <div className="px-1 pb-2">{children}</div>}
    </div>
  );
}
