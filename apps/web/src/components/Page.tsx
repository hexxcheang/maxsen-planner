import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Content-screen column: left-aligned, max 1120 px, page gutter. Marks the screen ready for e2e. */
export function Page({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      data-screen-ready
      className={cn(
        'px-[var(--gutter)] pt-7 pb-16',
        wide ? 'max-w-[1440px]' : 'max-w-[calc(var(--content-max)+2*var(--gutter))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
