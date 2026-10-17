import type { ReactNode } from 'react';
import { Check, HardHat, Plus, Smartphone, Truck, Wrench } from 'lucide-react';
import { SCHEDULE_STEPS, type Project, type ScheduleStep } from '@maxsen/domain';
import { DatePopover } from '@/components/ui/DatePicker';
import { cn } from '@/lib/cn';
import { useActions } from '@/lib/data/hooks';
import { daysBetween, formatDay, relativeDay, today } from '@/lib/dates';

const STEPS: Record<ScheduleStep, { label: string; icon: ReactNode }> = {
  siteLiaison: { label: 'Site liaising', icon: <HardHat /> },
  lightsDelivery: { label: 'Lights delivery', icon: <Truck /> },
  installation: { label: 'Installation', icon: <Wrench /> },
  integration: { label: 'Integration', icon: <Smartphone /> },
};

type State = 'empty' | 'skipped' | 'done' | 'today' | 'next' | 'later';

/**
 * The project's on-site dates as a timeline: site liaising, lights delivery (when there are lights
 * to deliver), installation and integration. Each opens a calendar; past dates tick off, and the
 * next one coming up is highlighted with how far away it is.
 */
export function ProjectSchedule({ project }: { project: Project }) {
  const actions = useActions();
  const schedule = project.schedule ?? {};
  const now = today();
  const skipped = (s: ScheduleStep) => s === 'lightsDelivery' && !!schedule.noLightsDelivery;
  const next = SCHEDULE_STEPS.map((s) => (skipped(s) ? null : schedule[s]))
    .filter((d): d is string => !!d && d > now)
    .sort()[0];
  const stateOf = (s: ScheduleStep): State => {
    if (skipped(s)) return 'skipped';
    const day = schedule[s];
    if (!day) return 'empty';
    if (day < now) return 'done';
    if (day === now) return 'today';
    return day === next ? 'next' : 'later';
  };
  // A date earlier than a step that should come before it.
  const outOfOrder = (i: number) => {
    const day = schedule[SCHEDULE_STEPS[i]!];
    if (!day || skipped(SCHEDULE_STEPS[i]!)) return null;
    for (let j = i - 1; j >= 0; j--) {
      const s = SCHEDULE_STEPS[j]!;
      const before = skipped(s) ? null : schedule[s];
      if (before && daysBetween(before, day) < 0) return STEPS[s].label;
    }
    return null;
  };

  return (
    <ol
      aria-label={`Schedule for ${project.title}`}
      className="grid grid-cols-4 gap-x-2 max-[700px]:grid-cols-2 max-[700px]:gap-y-2"
    >
      {SCHEDULE_STEPS.map((step, i) => {
        const { label, icon } = STEPS[step];
        const state = stateOf(step);
        const day = schedule[step] ?? null;
        const early = outOfOrder(i);
        const last = i === SCHEDULE_STEPS.length - 1;
        return (
          <li key={step} className="min-w-0">
            <DatePopover
              label={`${label} date`}
              value={day}
              onChange={(d) =>
                actions.updateProjectSchedule(project.id, {
                  [step]: d,
                  ...(step === 'lightsDelivery' && d ? { noLightsDelivery: false } : {}),
                })
              }
              footer={
                step === 'lightsDelivery'
                  ? (close) => (
                      <button
                        type="button"
                        onClick={() => {
                          actions.updateProjectSchedule(project.id, {
                            noLightsDelivery: !schedule.noLightsDelivery,
                            ...(schedule.noLightsDelivery ? {} : { lightsDelivery: null }),
                          });
                          close();
                        }}
                        className="rounded-control px-2 py-1 text-meta font-medium text-ink-2 hover:bg-paper hover:text-ink"
                      >
                        {schedule.noLightsDelivery
                          ? 'Lights are delivered'
                          : 'No lights to deliver'}
                      </button>
                    )
                  : undefined
              }
              trigger={
                <button
                  type="button"
                  aria-label={`${label}: ${
                    state === 'skipped' ? 'not needed' : day ? formatDay(day) : 'no date yet'
                  }. Pick a date`}
                  className="group flex w-full flex-col rounded-control py-1 text-left outline-offset-2"
                >
                  <span className="flex items-center">
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-[30px] shrink-0 items-center justify-center rounded-full border transition-colors [&_svg]:size-3.5',
                        state === 'empty' &&
                          'border-dashed border-rule-2 bg-surface text-ink-3 group-hover:border-ink-3 group-hover:text-ink-2',
                        state === 'skipped' && 'border-rule bg-paper text-ink-3/60',
                        state === 'done' && 'border-ok/40 bg-ok/10 text-ok',
                        state === 'today' && 'border-brass bg-brass text-surface',
                        state === 'next' &&
                          'border-brass bg-surface text-brass-2 group-hover:bg-brass-tint',
                        state === 'later' &&
                          'border-ink-3 bg-surface text-ink-2 group-hover:bg-paper',
                      )}
                    >
                      {state === 'done' ? <Check strokeWidth={2.5} /> : icon}
                    </span>
                    {/* The line on to the next step: solid once this one is done. */}
                    {!last && (
                      <span
                        aria-hidden
                        className={cn(
                          'mx-2 h-px flex-1 max-[700px]:hidden',
                          state === 'done' ? 'bg-ok/50' : 'bg-rule-2',
                        )}
                      />
                    )}
                  </span>
                  <span className="mt-1.5 flex min-w-0 flex-col">
                    <span className="truncate text-caption font-medium tracking-wide text-ink-3 uppercase">
                      {label}
                    </span>
                    {state === 'skipped' ? (
                      <span className="text-meta text-ink-3">Not needed</span>
                    ) : day ? (
                      <>
                        <span
                          className={cn(
                            'tnum truncate text-control font-medium',
                            state === 'done' ? 'text-ink-2' : 'text-ink',
                          )}
                        >
                          {formatDay(day, day.slice(0, 4) !== now.slice(0, 4))}
                        </span>
                        <span
                          className={cn(
                            'truncate text-meta',
                            state === 'done' && 'text-ok',
                            (state === 'today' || state === 'next') && 'font-semibold text-brass-2',
                            state === 'later' && 'text-ink-2',
                            early && 'text-warn',
                          )}
                        >
                          {early
                            ? `Before ${early.toLowerCase()}`
                            : state === 'done'
                              ? 'Done'
                              : relativeDay(day, now)}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-meta text-ink-3 group-hover:text-brass-2">
                        <Plus aria-hidden className="size-3" />
                        Add date
                      </span>
                    )}
                  </span>
                </button>
              }
            />
          </li>
        );
      })}
    </ol>
  );
}
