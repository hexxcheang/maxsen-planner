import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonClass, type ButtonSize, type ButtonVariant } from './styles';
import { Tooltip } from './Tooltip';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Renders the button disabled-but-focusable with this reason as its tooltip and description. */
  disabledReason?: string;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled,
    disabledReason,
    icon,
    className,
    children,
    onClick,
    type = 'button',
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const reasonId = useId();
  const inert = Boolean(disabledReason) || loading;
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const button = (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      disabled={disabled}
      aria-disabled={inert || disabled ? true : undefined}
      aria-busy={loading || undefined}
      aria-describedby={disabledReason ? reasonId : describedBy}
      {...rest}
      className={cn(buttonClass(variant, size), className)}
      onClick={handleClick}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );

  if (!disabledReason) return button;
  return (
    <>
      <Tooltip content={disabledReason}>{button}</Tooltip>
      <span id={reasonId} hidden>
        {disabledReason}
      </span>
    </>
  );
});
