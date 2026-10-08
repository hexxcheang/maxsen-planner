import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Lock,
  MapPin,
  Plus,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  byTime,
  clashes,
  newId,
  TIMETABLE_KIND_LABEL,
  type TimetableEvent,
  type TimetableKind,
} from '@maxsen/domain';
import { Button, PageHeader, SegmentedControl, Select, useToast } from '@/components/ui';
import { Page } from '@/components/Page';
import { useAdmin } from '@/app/auth/useAdmin';
import { cn } from '@/lib/cn';
import { addDays, formatDay, today, weekdayIndex } from '@/lib/dates';
import { EventDialog } from './EventDialog';
import { TeamDialog } from './TeamDialog';
import {
  deleteEvent,
  saveEvent,
  savePeople,
  TimetableError,
  useTimetable,
  type EventInput,
} from './timetable-api';

type Filter = 'all' | TimetableKind;
const ALL_PEOPLE = '__all__';

/**
 * The team timetable: sales meet-ups and installation duties, week by week. Everyone signed in
 * sees it; the admin schedules it.
 */
export function TimetableScreen() {
  const { timetable, state, refresh, setData } = useTimetable();
  const { unlocked, requireAdmin } = useAdmin();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => addDays(today(), -weekdayIndex(today())));
  const [filter, setFilter] = useState<Filter>('all');
  const [person, setPerson] = useState(ALL_PEOPLE);
  const [editing, setEditing] = useState<TimetableEvent | { date: string } | null>(null);
  const [team, setTeam] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shown = useMemo(
    () =>
      timetable.events
        .filter(
          (e) =>
            (filter === 'all' || e.kind === filter) &&
            (person === ALL_PEOPLE || e.people.includes(person)),
        )
        .sort(byTime),
    [timetable.events, filter, person],
  );
  const clash = useMemo(() => clashes(timetable.events), [timetable.events]);
  const inWeek = shown.filter((e) => e.date >= days[0]! && e.date <= days[6]!);
  const count = (k: TimetableKind) => inWeek.filter((e) => e.kind === k).length;

  /** Runs an admin change, asking for the admin passcode first if the server wants it. */
  const asAdmin = async <T,>(run: () => Promise<T>): Promise<T | undefined> => {
    if (!(await requireAdmin('schedule the timetable'))) return undefined;
    try {
      return await run();
    } catch (e) {
      if (e instanceof TimetableError && e.needsAdmin) {
        toast({ title: 'Unlock admin again to change the timetable', tone: 'danger' });
      } else
        toast({
          title: 'Not saved',
          body: e instanceof Error ? e.message : undefined,
          tone: 'danger',
        });
      return undefined;
    } finally {
      void refresh();
    }
  };

  const onSave = async (id: string, input: EventInput) => {
    const saved = await asAdmin(() => saveEvent(id, input));
    if (!saved) return false;
    setData((d) => d && { ...d, events: [...d.events.filter((e) => e.id !== id), saved] });
    toast({ title: 'Timetable updated', body: 'Everyone sees it.' });
    return true;
  };
  const onDelete = async (id: string) => {
    const done = await asAdmin(() => deleteEvent(id));
    if (!done) return false;
    setData((d) => d && { ...d, events: d.events.filter((e) => e.id !== id) });
    return true;
  };

  const week = `${formatDay(days[0]!, false)} – ${formatDay(days[6]!)}`;

  return (
    <Page wide>
      <PageHeader
        title="Timetable"
        description="Sales meet-ups and installation duties for the whole team. Everyone sees the same timetable; the admin schedules it."
        actions={
          unlocked ? (
            <>
              <Button icon={<Users className="size-4" />} onClick={() => setTeam(true)}>
                Team
              </Button>
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setEditing({ date: days.includes(today()) ? today() : days[0]! })}
              >
                New appointment
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              icon={<Lock className="size-4" />}
              onClick={() => void requireAdmin('schedule the timetable')}
            >
              Admin: schedule
            </Button>
          )
        }
      />

      {state === 'unavailable' ? (
        <p className="flex items-center gap-2 border-t border-rule py-10 text-body text-ink-2">
          <CloudOff aria-hidden className="size-5" />
          The timetable is shared through the team server, which can’t be reached from here.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                icon={<ChevronLeft className="size-4" />}
                aria-label="Previous week"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
              />
              <Button
                size="sm"
                onClick={() => setWeekStart(addDays(today(), -weekdayIndex(today())))}
              >
                This week
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<ChevronRight className="size-4" />}
                aria-label="Next week"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
              />
            </div>
            <h2 className="text-section text-ink" data-testid="timetable-week">
              {week}
            </h2>
            <SegmentedControl<Filter>
              size="sm"
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'sales', label: `Sales meet-ups (${count('sales')})` },
                { value: 'installation', label: `Installations (${count('installation')})` },
              ]}
            />
            <div className="w-48">
              <Select
                compact
                aria-label="Whose appointments"
                value={person}
                onChange={setPerson}
                options={[
                  { value: ALL_PEOPLE, label: 'Everyone' },
                  ...timetable.people.map((p) => ({ value: p, label: p })),
                ]}
              />
            </div>
            {state === 'offline' && (
              <span className="flex items-center gap-1.5 text-meta text-ink-2">
                <CloudOff aria-hidden className="size-4" />
                Offline: showing the last copy
              </span>
            )}
          </div>

          <div
            role="grid"
            aria-label={`Week of ${week}`}
            className="grid grid-cols-7 gap-2 max-[900px]:grid-cols-1"
          >
            {days.map((day) => {
              const items = shown.filter((e) => e.date === day);
              const isToday = day === today();
              return (
                <section
                  key={day}
                  role="gridcell"
                  aria-label={formatDay(day)}
                  className={cn(
                    'flex min-h-40 min-w-0 flex-col gap-1.5 rounded-md border p-1.5 max-[900px]:min-h-0',
                    isToday ? 'border-ink bg-surface' : 'border-rule bg-surface/60',
                  )}
                >
                  <header className="flex items-center justify-between px-1">
                    <span
                      className={cn('text-meta', isToday ? 'font-semibold text-ink' : 'text-ink-2')}
                    >
                      {formatDay(day, false)}
                    </span>
                    {unlocked && (
                      <button
                        type="button"
                        aria-label={`New appointment on ${formatDay(day)}`}
                        className="rounded-control p-0.5 text-ink-3 hover:bg-paper hover:text-ink"
                        onClick={() => setEditing({ date: day })}
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </header>
                  {items.length === 0 && (
                    <p className="px-1 text-caption text-ink-3 max-[900px]:hidden">Nothing yet</p>
                  )}
                  {items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEditing(e)}
                      aria-label={`${TIMETABLE_KIND_LABEL[e.kind]}: ${e.title}, ${e.start} to ${e.end}`}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-control border-l-[3px] px-2 py-1.5 text-left',
                        e.kind === 'sales'
                          ? 'border-sales bg-sales-tint'
                          : 'border-brass bg-brass-tint',
                      )}
                    >
                      <span className="tnum flex items-center gap-1 text-caption text-ink-2">
                        {e.start}–{e.end}
                        {clash.has(e.id) && (
                          <TriangleAlert
                            aria-label={`Double-booked: ${clash.get(e.id)!.join(', ')}`}
                            className="size-3.5 text-warn"
                          />
                        )}
                      </span>
                      <span className="text-control leading-tight font-medium text-ink">
                        {e.title}
                      </span>
                      {e.address && (
                        <span className="flex items-start gap-1 text-caption text-ink-2">
                          <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2">{e.address}</span>
                        </span>
                      )}
                      {e.people.length > 0 && (
                        <span className="text-caption text-ink-2">{e.people.join(', ')}</span>
                      )}
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-4 text-meta text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-sales" /> Sales meet-up
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-brass" /> Installation
            </span>
            <span className="flex items-center gap-1.5">
              <TriangleAlert aria-hidden className="size-3.5 text-warn" /> Someone is double-booked
            </span>
          </p>
        </>
      )}

      <EventDialog
        key={editing && 'id' in editing ? editing.id : (editing?.date ?? 'none')}
        open={editing !== null}
        event={editing && 'id' in editing ? editing : null}
        date={editing && !('id' in editing) ? editing.date : undefined}
        editable={unlocked}
        people={timetable.people}
        clashWith={editing && 'id' in editing ? clash.get(editing.id) : undefined}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          const id = editing && 'id' in editing ? editing.id : newId('el').replace(/^el_/, 'tt_');
          if (await onSave(id, input)) setEditing(null);
        }}
        onDelete={async () => {
          if (editing && 'id' in editing && (await onDelete(editing.id))) setEditing(null);
        }}
      />
      <TeamDialog
        open={team}
        people={timetable.people}
        onClose={() => setTeam(false)}
        onSave={async (people) => {
          const saved = await asAdmin(() => savePeople(people));
          if (saved) {
            setData((d) => d && { ...d, people: saved.people });
            setTeam(false);
          }
        }}
      />
    </Page>
  );
}
