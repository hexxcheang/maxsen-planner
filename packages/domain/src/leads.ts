/**
 * Sales leads, shared by everyone signed in: who they are, where they came from, where they stand,
 * who's following up and when, and a running log of notes.
 */

export const LEAD_STATUSES = ['new', 'contacted', 'meeting', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  meeting: 'Meet-up set',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
};

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
  /** The project made from this lead, once it's converted. */
  projectId?: string;
  notes: LeadNote[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
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
