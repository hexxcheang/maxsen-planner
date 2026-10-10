import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field-context';
import { controlClass } from './styles';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Leading adornment (icon) rendered inside the control. */
  leading?: ReactNode;
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, compact, id, ...rest },
  ref,
) {
  const field = useFieldControl();
  const input = (
    <input
      ref={ref}
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        controlClass,
        compact ? 'h-[var(--control-h-compact)]' : 'h-[var(--control-h)]',
        leading ? 'pl-8' : undefined,
        className,
      )}
      {...rest}
    />
  );
  if (!leading) return input;
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-ink-3 [&_svg]:size-4">
        {leading}
      </span>
      {input}
    </div>
  );
});
