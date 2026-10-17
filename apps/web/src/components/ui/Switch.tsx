import * as RS from '@radix-ui/react-switch';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id} className="flex min-w-0 flex-col text-control text-ink">
        <span>{label}</span>
        {description && <span className="text-meta text-ink-2">{description}</span>}
      </label>
      <RS.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-colors duration-[var(--dur)]',
          'border-rule-2 bg-rule data-[state=checked]:border-brass data-[state=checked]:bg-brass',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RS.Thumb className="block size-3.5 translate-x-px rounded-full bg-surface shadow-[0_1px_2px_rgba(31,29,26,.25)] transition-transform duration-[var(--dur)] data-[state=checked]:translate-x-[15px]" />
      </RS.Root>
    </div>
  );
}
