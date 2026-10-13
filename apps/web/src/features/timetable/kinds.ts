import type { TimetableKind } from '@maxsen/domain';

/** Each kind of appointment's colour on the timetable: its card, and its square in the legend. */
export const KIND_TONE: Record<TimetableKind, { card: string; dot: string }> = {
  sales: { card: 'border-sales bg-sales-tint', dot: 'bg-sales' },
  'site-visit': { card: 'border-visit bg-visit-tint', dot: 'bg-visit' },
  delivery: { card: 'border-delivery bg-delivery-tint', dot: 'bg-delivery' },
  installation: { card: 'border-brass bg-brass-tint', dot: 'bg-brass' },
  integration: { card: 'border-integration bg-integration-tint', dot: 'bg-integration' },
};

/** What a new appointment of each kind might be called. */
export const KIND_EXAMPLE: Record<TimetableKind, string> = {
  sales: 'e.g. Showroom visit, Mr Lim',
  'site-visit': 'e.g. Site measurement, Tan residence',
  delivery: 'e.g. Deliver switches and lights',
  installation: 'e.g. Install switches and lights',
  integration: 'e.g. Set up the app and scenes',
};
