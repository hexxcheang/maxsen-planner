import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** A radio group drawn as joined segments: Smart Home | Lighting, A4 | A3, Portrait | Landscape. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (e: KeyboardEvent) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!dir) return;
    e.preventDefault();
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex shrink-0 rounded-control border border-rule-2 bg-paper p-0.5',
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        // Keep the group reachable by Tab even when no option matches the value.
        const tabbable = selected || (!options.some((x) => x.value === value) && o === enabled[0]);
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[3px] px-2.5 text-control whitespace-nowrap transition-colors duration-[var(--dur)]',
              size === 'sm' ? 'h-[22px]' : 'h-[26px]',
              selected
                ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--rule-2)]'
                : 'text-ink-2 hover:text-ink',
              'disabled:cursor-not-allowed disabled:text-ink-3',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
