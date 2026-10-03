/**
 * Calendar days as "YYYY-MM-DD" strings: no time or time zone, so a date picked in the app is the
 * same day everywhere. "Today" is today in Singapore.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface Ymd {
  y: number;
  /** 0–11 */
  m: number;
  d: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = ({ y, m, d }: Ymd) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function parseDay(day: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

const utc = (day: string) => {
  const p = parseDay(day);
  return p ? Date.UTC(p.y, p.m, p.d) : NaN;
};

export function today(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function addDays(day: string, n: number): string {
  const t = new Date(utc(day) + n * 86_400_000);
  return toDay({ y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() });
}

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86_400_000);

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (day: string) => (new Date(utc(day)).getUTCDay() + 6) % 7;

/** "Mon, 12 Oct 2026" */
export function formatDay(day: string, withYear = true): string {
  const p = parseDay(day);
  if (!p) return day;
  const wd = WEEKDAYS[new Date(utc(day)).getUTCDay()];
  return `${wd}, ${p.d} ${MONTHS[p.m]}${withYear ? ` ${p.y}` : ''}`;
}

export const monthTitle = (y: number, m: number) => `${MONTHS_LONG[m]} ${y}`;

/** The days shown for a month: whole weeks, Monday first, including the edges of the next and previous months. */
export function monthGrid(y: number, m: number): string[] {
  const first = toDay({ y, m, d: 1 });
  const start = addDays(first, -weekdayIndex(first));
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = Math.ceil((weekdayIndex(first) + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

/** "Today", "Tomorrow", "In 3 days", "2 days ago". */
export function relativeDay(day: string, from: string = today()): string {
  const n = daysBetween(from, day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 0)
    return n < 14
      ? `In ${n} days`
      : n < 60
        ? `In ${Math.round(n / 7)} weeks`
        : `In ${Math.round(n / 30)} months`;
  return -n < 14 ? `${-n} days ago` : `${Math.round(-n / 7)} weeks ago`;
}
