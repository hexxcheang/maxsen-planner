import * as RM from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  /** Shown instead of acting, for items deferred to a later phase. */
  disabledReason?: string;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: (MenuItem | 'separator')[];
  align?: 'start' | 'end';
}

export function DropdownMenu({ trigger, items, align = 'end' }: DropdownMenuProps) {
  return (
    <RM.Root modal={false}>
      <RM.Trigger asChild>{trigger}</RM.Trigger>
      <RM.Portal>
        <RM.Content
          align={align}
          sideOffset={4}
          className="z-[var(--z-popover)] min-w-48 rounded-popover border border-rule bg-surface p-1 shadow-float"
        >
          {items.map((item, i) =>
            item === 'separator' ? (
              <RM.Separator key={`sep-${i}`} className="my-1 h-px bg-rule" />
            ) : (
              <RM.Item
                key={item.label}
                disabled={Boolean(item.disabledReason)}
                onSelect={() => {
                  // Defer until the menu has closed and refocused its trigger, so a dialog opened
                  // here remembers the trigger (not the unmounting item) as its focus-return target.
                  if (item.onSelect) requestAnimationFrame(item.onSelect);
                }}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-[3px] px-2 py-1.5 text-control outline-none select-none',
                  '[&_svg]:size-4 [&_svg]:text-ink-2',
                  item.destructive ? 'text-danger [&_svg]:text-danger' : 'text-ink',
                  'data-[highlighted]:bg-paper data-[disabled]:text-ink-3 data-[disabled]:[&_svg]:text-ink-3',
                )}
              >
                {item.icon}
                <span className="flex flex-col">
                  {item.label}
                  {item.disabledReason && (
                    <span className="text-caption text-ink-3">{item.disabledReason}</span>
                  )}
                </span>
              </RM.Item>
            ),
          )}
        </RM.Content>
      </RM.Portal>
    </RM.Root>
  );
}
