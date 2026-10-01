import { useEffect, useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field-context';
import { controlClass } from './styles';

interface NumberFieldProps {
  value: number | null;
  /** Called on commit (blur or Enter) with a parsed, clamped value; null when cleared and allowed. */
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places kept on commit. */
  precision?: number;
  unit?: string;
  allowEmpty?: boolean;
  /** Shows −/+ buttons. */
  stepper?: boolean;
  disabled?: boolean;
  compact?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  id?: string;
}

const format = (v: number | null) => (v === null ? '' : String(v));

export function NumberField({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  unit,
  allowEmpty = false,
  stepper = false,
  disabled,
  compact,
  placeholder,
  className,
  id,
  ...aria
}: NumberFieldProps) {
  const field = useFieldControl();
  const [text, setText] = useState(format(value));
  useEffect(() => setText(format(value)), [value]);

  const clamp = (n: number) => {
    const f = 10 ** precision;
    return Math.min(max, Math.max(min, Math.round(n * f) / f));
  };

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (allowEmpty) {
        if (value !== null) onChange?.(null);
      } else setText(format(value));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setText(format(value));
      return;
    }
    const next = clamp(n);
    setText(format(next));
    if (next !== value) onChange?.(next);
  };

  const nudge = (dir: 1 | -1) => commit(String((value ?? 0) + dir * step));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(text);
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(1);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(-1);
    }
  };

  const h = compact ? 'h-[var(--control-h-compact)]' : 'h-[var(--control-h)]';
  return (
    <div className={cn('flex items-stretch', className)}>
      {stepper && (
        <button
          type="button"
          aria-label="Decrease"
          disabled={disabled || (value ?? 0) <= min}
          onClick={() => nudge(-1)}
          className={cn(
            h,
            'flex aspect-square items-center justify-center rounded-l-control border border-r-0 border-rule-2 bg-surface text-ink-2 hover:text-ink disabled:text-ink-3',
          )}
        >
          <Minus className="size-3.5" />
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        <input
          id={id ?? field?.id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={onKeyDown}
          className={cn(
            controlClass,
            h,
            'tnum text-right',
            unit && 'pr-7',
            stepper && 'rounded-none text-center',
          )}
          {...aria}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-control text-ink-3">
            {unit}
          </span>
        )}
      </div>
      {stepper && (
        <button
          type="button"
          aria-label="Increase"
          disabled={disabled || (value ?? 0) >= max}
          onClick={() => nudge(1)}
          className={cn(
            h,
            'flex aspect-square items-center justify-center rounded-r-control border border-l-0 border-rule-2 bg-surface text-ink-2 hover:text-ink disabled:text-ink-3',
          )}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
