/**
 * Sales leads, shared by everyone signed in: who they are, where they came from, where they stand,
 * who's following up and when, and a running log of notes.
 */

/** Where a lead stands, in the order a sale usually goes. */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'no-reply',
  'meeting',
  'visited',
  'quoted',
  'considering',
  'on-hold',
  'won',
  'lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  'no-reply': 'No reply yet',
  meeting: 'Meet-up set',
  visited: 'Met / site visit done',
  quoted: 'Quoted',
  considering: 'Considering quote',
  'on-hold': 'On hold (reno later)',
  won: 'Won',
  lost: 'Lost',
};

/** Where a lead came to us: passed on by MyDigitalLock, or found by us. */
export const LEAD_CHANNELS = ['mydigitallock', 'own'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_CHANNEL_LABEL: Record<LeadChannel, string> = {
  mydigitallock: 'MyDigitalLock',
  own: 'Maxsen leads',
};

/** A lead's channel; leads added before channels count as Maxsen leads. */
export const channelOf = (l: Pick<Lead, 'channel'>): LeadChannel => l.channel ?? 'own';

export const LEAD_SOURCES = [
  'Showroom walk-in',
  'Instagram',
  'Facebook',
  'TikTok',
  'Website',
  'Referral',
  'Interior designer',
  'Roadshow',
  'Other',
] as const;

export interface LeadNote {
  at: string;
  by: string;
  text: string;
}

export interface Lead {
  id: string;
  name: string;
  phone?: string;
  /** MyDigitalLock or Maxsen; missing on leads added before the split (Maxsen). */
  channel?: LeadChannel;
  email?: string;
  address?: string;
  propertyType?: string;
  source?: string;
  /** What they're interested in: switches, lighting, curtains… */
  interest?: string;
  budget?: string;
  status: LeadStatus;
  assignedTo?: string;
  /** YYYY-MM-DD */
  followUp?: string;
  /** When we last spoke to or messaged them, YYYY-MM-DD. */
  lastContacted?: string;
  /** When their renovation is expected to start, YYYY-MM-DD. */
  renoDate?: string;
  /** The project made from this lead, once it's converted. */
  projectId?: string;
  notes: LeadNote[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/** Statuses that mean we've just been in touch with them. */
const IN_TOUCH: readonly LeadStatus[] = [
  'contacted',
  'meeting',
  'visited',
  'quoted',
  'considering',
];

/**
 * The last-contacted day after moving a lead to `status` on `today`: moving it on to a stage that
 * means we've been in touch makes it today; otherwise it stays as it was.
 */
export function contactedOn(
  status: LeadStatus,
  previous: LeadStatus,
  lastContacted: string | undefined,
  today: string,
): string | undefined {
  if (status === previous || !IN_TOUCH.includes(status)) return lastContacted;
  return lastContacted && lastContacted > today ? lastContacted : today;
}

/** What's still being worked: not won or lost. */
export const isOpen = (l: Lead) => l.status !== 'won' && l.status !== 'lost';

/** An open lead whose follow-up day has passed. */
export const isOverdue = (l: Lead, today: string) =>
  isOpen(l) && !!l.followUp && l.followUp < today;

/** Leads to work first: overdue, then by follow-up day, then newest. */
export function byPriority(today: string) {
  return (a: Lead, b: Lead) =>
    Number(isOverdue(b, today)) - Number(isOverdue(a, today)) ||
    Number(isOpen(b)) - Number(isOpen(a)) ||
    (a.followUp ?? '9999').localeCompare(b.followUp ?? '9999') ||
    b.createdAt.localeCompare(a.createdAt);
}

/** Leads matching a search over name, phone, address, source, interest and notes. */
export function matchLead(l: Lead, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [
    l.name,
    l.phone,
    l.email,
    l.address,
    l.source,
    l.interest,
    l.assignedTo,
    ...l.notes.map((n) => n.text),
  ]
    .filter(Boolean)
    .some((s) => s!.toLowerCase().includes(q));
}

/** A WhatsApp link for a phone number (Singapore numbers get +65). */
export function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits.length === 8 ? `65${digits}` : digits}`;
}
