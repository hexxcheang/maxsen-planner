import * as RT from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = RT.Root;

export function TabsList({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <RT.List aria-label={label} className={cn('flex gap-5 border-b border-rule', className)}>
      {children}
    </RT.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RT.Trigger
      value={value}
      className={cn(
        '-mb-px border-b-2 border-transparent pb-2 text-control text-ink-2 transition-colors duration-[var(--dur)]',
        'hover:text-ink data-[state=active]:border-brass data-[state=active]:font-medium data-[state=active]:text-ink',
      )}
    >
      {children}
    </RT.Trigger>
  );
}

export const TabsContent = RT.Content;
