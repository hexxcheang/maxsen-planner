import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as RP from '@radix-ui/react-popover';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { addDays, formatDay, monthGrid, monthTitle, parseDay, today } from '@/lib/dates';

const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * A month calendar: pick a day with a click or the keyboard (arrows move a day or a week, Page
 * Up/Down a month, Home/End the week's ends).
 */
export function Calendar({
  value,
  onSelect,
  label,
}: {
  value: string | null;
  onSelect: (day: string) => void;
  label: string;
}) {
  const now = today();
  const [focus, setFocus] = useState(value ?? now);
  const shown = parseDay(focus)!;
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus]);

  const move = (day: string) => {
    moved.current = true;
    setFocus(day);
  };
  const shiftMonth = (by: number) => {
    const d = new Date(Date.UTC(shown.y, shown.m + by, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(shown.d, last);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => shiftMonth(-1),
      PageDown: () => shiftMonth(1),
      Home: () => addDays(focus, -((new Date(`${focus}T00:00:00Z`).getUTCDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((new Date(`${focus}T00:00:00Z`).getUTCDay() + 6) % 7)),
    };
    const next = step[e.key];
    if (!next) return;
    e.preventDefault();
    move(next());
  };

  return (
    <div className="w-[264px]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setFocus(shiftMonth(-1))}
          className="flex size-7 items-center justify-center rounded-control text-ink-2 hover:bg-paper hover:text-ink"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p aria-live="polite" className="text-control font-semibold text-ink">
          {monthTitle(shown.y, shown.m)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setFocus(shiftMonth(1))}
          className="flex size-7 items-center justify-center rounded-control text-ink-2 hover:bg-paper hover:text-ink"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={`${label}, ${monthTitle(shown.y, shown.m)}`}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-0.5"
      >
        {WEEK.map((w, i) => (
          <span
            key={w}
            role="columnheader"
            className={cn(
              'pb-1 text-center text-caption font-medium text-ink-3',
              i >= 5 && 'text-ink-3/70',
            )}
          >
            {w}
          </span>
        ))}
        {monthGrid(shown.y, shown.m).map((day) => {
          const p = parseDay(day)!;
          const outside = p.m !== shown.m;
          const selected = day === value;
          const isToday = day === now;
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              data-day={day}
              tabIndex={day === focus ? 0 : -1}
              aria-selected={selected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={formatDay(day)}
              onClick={() => onSelect(day)}
              className={cn(
                'tnum relative flex h-8 items-center justify-center rounded-control text-control outline-offset-1',
                outside ? 'text-ink-3/60' : 'text-ink',
                !selected && 'hover:bg-paper',
                selected && 'bg-ink font-semibold text-surface',
                isToday && !selected && 'font-semibold text-brass-2',
              )}
            >
              {p.d}
              {isToday && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-1 size-1 rounded-full',
                    selected ? 'bg-surface' : 'bg-brass',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A trigger that opens a calendar in a pop-up; picking a day closes it. */
export function DatePopover({
  value,
  onChange,
  label,
  trigger,
  footer,
}: {
  value: string | null;
  onChange: (day: string | null) => void;
  label: string;
  trigger: ReactNode;
  /** Extra actions under the calendar (e.g. "Not needed"); receives a function to close. */
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <RP.Root open={open} onOpenChange={setOpen}>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          side="bottom"
          align="start"
          sideOffset={6}
          aria-label={label}
          onOpenAutoFocus={(e) => {
            // Focus the chosen (or today's) day, so the keyboard works straight away.
            e.preventDefault();
            const el = e.currentTarget as HTMLElement | null;
            requestAnimationFrame(() =>
              el?.querySelector<HTMLButtonElement>('[role="gridcell"][tabindex="0"]')?.focus(),
            );
          }}
          className="z-[var(--z-popover)] rounded-popover border border-rule bg-surface p-3 shadow-float outline-none"
        >
          <p className="mb-2 text-meta font-semibold tracking-wide text-ink-2 uppercase">{label}</p>
          <Calendar
            label={label}
            value={value}
            onSelect={(day) => {
              onChange(day);
              close();
            }}
          />
          <div className="mt-3 flex items-center gap-2 border-t border-rule pt-2.5">
            <button
              type="button"
              onClick={() => {
                onChange(today());
                close();
              }}
              className="rounded-control px-2 py-1 text-meta font-medium text-ink hover:bg-paper"
            >
              Today
            </button>
            {footer?.(close)}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  close();
                }}
                className="ml-auto rounded-control px-2 py-1 text-meta font-medium text-danger hover:bg-danger-tint"
              >
                Clear date
              </button>
            )}
          </div>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
