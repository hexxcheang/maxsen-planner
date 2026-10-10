import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field-context';
import { controlClass } from './styles';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: string;
  options: readonly SelectOption[];
  onChange?: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}

/** A styled native select: reliable with touch on iPad and with assistive technology. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { value, options, onChange, compact, placeholder, className, id, ...rest },
  ref,
) {
  const field = useFieldControl();
  return (
    <div className={cn('relative w-full', className)}>
      <select
        ref={ref}
        id={id ?? field?.id}
        value={value}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          controlClass,
          'appearance-none pr-8',
          compact ? 'h-[var(--control-h-compact)]' : 'h-[var(--control-h)]',
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
});
