import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
  active?: boolean;
  disabledReason?: string;
  /** Hide the hover tooltip (for buttons whose label is visible next to them). */
  noTooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    size = 'md',
    variant = 'ghost',
    active = false,
    disabledReason,
    noTooltip = false,
    className,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const reasonId = useId();
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabledReason) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      aria-disabled={disabledReason ? true : undefined}
      aria-describedby={disabledReason ? reasonId : undefined}
      onClick={handleClick}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control border transition-colors duration-[var(--dur)]',
        size === 'sm' ? 'size-[var(--control-h-compact)]' : 'size-[var(--control-h)]',
        variant === 'secondary'
          ? 'border-rule-2 bg-surface hover:border-ink-3'
          : 'border-transparent hover:bg-desk/70',
        active && 'border-brass/40 bg-brass-tint text-brass-2 hover:bg-brass-tint',
        'text-ink aria-disabled:cursor-not-allowed aria-disabled:text-ink-3 aria-disabled:hover:bg-transparent',
        'disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent',
        '[&_svg]:size-4',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
  if (noTooltip && !disabledReason) return button;
  if (!disabledReason) return <Tooltip content={label}>{button}</Tooltip>;
  return (
    <>
      <Tooltip content={`${label}: ${disabledReason}`}>{button}</Tooltip>
      <span id={reasonId} hidden>
        {disabledReason}
      </span>
    </>
  );
});
