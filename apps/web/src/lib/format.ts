import type { ProjectStatus, PropertyType } from '@maxsen/domain';

/** Singapore is where every Maxsen planner works; pin the zone so dates read the same everywhere. */
const TIME_ZONE = 'Asia/Singapore';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  'in-progress': 'In progress',
  completed: 'Completed',
};

export const PROPERTY_TYPES: readonly PropertyType[] = [
  'HDB',
  'Condo',
  'Landed',
  'Commercial',
  'Other',
];

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateOnly = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** "29 Sep 2026, 16:42" */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** "29 Sep 2026" */
export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** Relative within the last day ("12 minutes ago"), otherwise the full date and time. */
export function formatUpdated(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (diff < 0 || minutes >= 24 * 60) return formatDateTime(iso);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

/** "4.5 m", "17 m" */
export function formatMetres(metres: number): string {
  return `${Number(metres.toFixed(1))} m`;
}

/** A quantity with its unit as shown in totals: "12" for pieces, "4.5 m" for metres. */
export function formatQuantity(quantity: number, unit: 'pcs' | 'm'): string {
  return unit === 'm' ? formatMetres(quantity) : String(quantity);
}
