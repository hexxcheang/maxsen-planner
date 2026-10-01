import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

/** The reason shown on every control that is deliberately not wired up yet in Phase A. */
export const LATER_PHASE = 'Available in a later phase';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RT.Provider delayDuration={300} skipDelayDuration={150}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content
            side={side}
            sideOffset={6}
            className="z-[var(--z-popover)] max-w-64 rounded-control bg-ink px-2 py-1 text-meta text-surface shadow-float data-[state=closed]:opacity-0"
          >
            {content}
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
