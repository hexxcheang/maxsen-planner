import * as RD from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  role?: 'dialog' | 'alertdialog';
}

const WIDTHS = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' } as const;

/** Modal dialog: traps focus, closes on Escape, returns focus to whatever opened it. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'md',
  role = 'dialog',
}: DialogProps) {
  // Radix only restores focus to its own Trigger; our dialogs are opened from anywhere, so remember
  // what had focus at the moment the dialog opened and return there on close.
  const wasOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    returnFocus.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = open;

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[var(--z-dialog)] bg-ink/25 data-[state=open]:animate-[fade-in_var(--dur)_var(--ease)]" />
        <RD.Content
          role={role}
          className={cn(
            'fixed top-1/2 left-1/2 z-[var(--z-dialog)] flex max-h-[calc(100dvh-48px)] w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-popover border border-rule bg-surface shadow-float outline-none',
            'data-[state=open]:animate-[dialog-in_var(--dur)_var(--ease)]',
            WIDTHS[width],
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={(e) => {
            const target = returnFocus.current;
            if (target && target.isConnected) {
              e.preventDefault();
              target.focus();
            }
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-rule px-5 pt-4 pb-3">
            <div className="min-w-0">
              <RD.Title className="text-section text-ink">{title}</RD.Title>
              {description && (
                <RD.Description className="mt-0.5 text-control text-ink-2">
                  {description}
                </RD.Description>
              )}
            </div>
            <RD.Close
              aria-label="Close"
              className="-mr-1.5 inline-flex size-7 items-center justify-center rounded-control text-ink-2 hover:bg-paper hover:text-ink"
            >
              <X className="size-4" />
            </RD.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-rule px-5 py-3">
              {footer}
            </div>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
