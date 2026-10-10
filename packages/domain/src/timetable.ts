/**
 * The team timetable: sales meet-ups and installation duties, shared by everyone signed in and
 * scheduled by the admin.
 */

export const TIMETABLE_KINDS = ['sales', 'installation'] as const;
export type TimetableKind = (typeof TIMETABLE_KINDS)[number];

export const TIMETABLE_KIND_LABEL: Record<TimetableKind, string> = {
  sales: 'Sales meet-up',
  installation: 'Installation',
};

export interface TimetableEvent {
  id: string;
  kind: TimetableKind;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  start: string;
  end: string;
  title: string;
  client?: string;
  address?: string;
  /** Who's going: names from the team list. */
  people: string[];
  /** The project it's for, if any. */
  projectId?: string;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Timetable {
  events: TimetableEvent[];
  /** The team, to assign appointments to. */
  people: string[];
}

/** Minutes since midnight of an HH:MM time. */
export const minutesOf = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Events in time order: by date, then start, then end. */
export const byTime = (a: TimetableEvent, b: TimetableEvent) =>
  a.date.localeCompare(b.date) ||
  minutesOf(a.start) - minutesOf(b.start) ||
  minutesOf(a.end) - minutesOf(b.end);

/**
 * Appointments on the same day that overlap and share someone, so the admin sees double-booking
 * at a glance: each clashing event's id with the names it clashes on.
 */
export function clashes(events: TimetableEvent[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  const sorted = [...events].sort(byTime);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (b.date !== a.date) break;
      if (minutesOf(b.start) >= minutesOf(a.end)) continue;
      const shared = a.people.filter((p) => b.people.includes(p));
      for (const e of [a, b]) {
        const set = out.get(e.id) ?? new Set<string>();
        for (const p of shared) set.add(p);
        if (shared.length) out.set(e.id, set);
      }
    }
  }
  return new Map([...out].map(([id, s]) => [id, [...s]]));
}
