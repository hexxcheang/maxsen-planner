import * as RC from '@radix-ui/react-checkbox';
import { useId, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onCheckedChange, label, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <RC.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-rule-2 bg-surface text-surface',
          'hover:border-ink-3 data-[state=checked]:border-brass data-[state=checked]:bg-brass',
          'data-[state=indeterminate]:border-brass data-[state=indeterminate]:bg-brass disabled:opacity-50',
        )}
      >
        <RC.Indicator>
          {checked === 'indeterminate' ? (
            <Minus className="size-3" strokeWidth={3} />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
        </RC.Indicator>
      </RC.Root>
      <label htmlFor={id} className="min-w-0 text-control text-ink select-none">
        {label}
      </label>
    </div>
  );
}
