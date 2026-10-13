/**
 * The team timetable: sales meet-ups and installation duties, shared by everyone signed in and
 * scheduled by the admin.
 */

export const TIMETABLE_KINDS = [
  'sales',
  'site-visit',
  'delivery',
  'installation',
  'integration',
] as const;
export type TimetableKind = (typeof TIMETABLE_KINDS)[number];

export const TIMETABLE_KIND_LABEL: Record<TimetableKind, string> = {
  sales: 'Sales meet-up',
  'site-visit': 'Site visit',
  delivery: 'Delivery',
  installation: 'Installation',
  integration: 'Integration',
};

/** The same, in a sentence ("a site visit", "an installation"). */
const KIND_IN_TEXT: Record<TimetableKind, string> = {
  sales: 'a sales meet-up',
  'site-visit': 'a site visit',
  delivery: 'a delivery',
  installation: 'an installation',
  integration: 'an integration appointment',
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
  /** Each person's WhatsApp number, by name. */
  phones?: Record<string, string>;
  /** Whether scheduling offers to tell the people assigned on WhatsApp (the admin's choice). */
  notify?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 14 Oct 2026" for a YYYY-MM-DD day. */
function longDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * The WhatsApp message telling someone about an appointment they're assigned to: what, when,
 * where (with a map link), who else is going, and the notes.
 */
export function appointmentMessage(
  e: Pick<
    TimetableEvent,
    'kind' | 'title' | 'date' | 'start' | 'end' | 'client' | 'address' | 'people' | 'notes'
  >,
  name: string,
  opts: { changed?: boolean; from?: string } = {},
): string {
  const kind = KIND_IN_TEXT[e.kind];
  const others = e.people.filter((p) => p !== name);
  return [
    `Hi ${name}, ${opts.changed ? `${kind.replace(/^an? /, 'your ')} has been updated` : `you're scheduled for ${kind}`}:`,
    `*${e.title}*`,
    `${longDay(e.date)}, ${e.start}–${e.end}`,
    ...(e.client ? [`Client: ${e.client}`] : []),
    ...(e.address
      ? [
          `Address: ${e.address}`,
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address)}`,
        ]
      : []),
    ...(others.length ? [`With: ${others.join(', ')}`] : []),
    ...(e.notes ? [`Notes: ${e.notes}`] : []),
    ...(opts.from ? ['', `– ${opts.from}, Maxsen`] : []),
  ].join('\n');
}

/**
 * A link that opens WhatsApp with the message written, to the number given (Singapore numbers
 * get +65), or for choosing the contact when there's no number.
 */
export function whatsappMessageLink(phone: string | undefined, text: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const to = digits.length === 8 ? `65${digits}` : digits.length >= 8 ? digits : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
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
