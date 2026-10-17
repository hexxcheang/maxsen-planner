import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brass text-surface border-brass hover:bg-brass-2 hover:border-brass-2 aria-disabled:bg-rule-2 aria-disabled:border-rule-2',
  secondary:
    'bg-surface text-ink border-rule-2 hover:border-ink-3 hover:bg-paper aria-disabled:text-ink-3 aria-disabled:border-rule',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-desk/60 aria-disabled:text-ink-3',
  danger:
    'bg-surface text-danger border-danger/40 hover:bg-danger-tint hover:border-danger aria-disabled:text-ink-3 aria-disabled:border-rule',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-[var(--control-h-compact)] px-2.5 gap-1.5 text-control',
  md: 'h-[var(--control-h)] px-3.5 gap-2 text-control',
};

export const buttonClass = (variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') =>
  cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control border font-medium',
    'transition-colors duration-[var(--dur)] ease-[var(--ease)]',
    'aria-disabled:cursor-not-allowed disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
  );

export const controlClass = cn(
  'w-full rounded-control border border-rule-2 bg-surface px-2.5 text-control text-ink',
  'placeholder:text-ink-3 hover:border-ink-3 transition-colors duration-[var(--dur)]',
  'focus-visible:border-brass focus-visible:outline-offset-0',
  'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-3 disabled:hover:border-rule-2',
  'aria-invalid:border-danger',
);
