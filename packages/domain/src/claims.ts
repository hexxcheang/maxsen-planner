/**
 * Expense claims: someone on the team pays for something for work (materials, parking, a tool),
 * uploads the receipts and says what it was for; the admin approves or rejects it.
 */

export const CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const CLAIM_CATEGORIES = [
  'Materials',
  'Tools',
  'Transport',
  'Parking',
  'Meals',
  'Client gifts',
  'Others',
] as const;

export interface Claim {
  id: string;
  /** Who paid and is claiming it. */
  claimant: string;
  /** When it was bought, YYYY-MM-DD. */
  date: string;
  /** In S$. */
  amount: number;
  /** What it was bought for. */
  purpose: string;
  category?: string;
  /** The project or site it was for, if any. */
  site?: string;
  /** The receipts: pictures or PDFs kept on the team server. */
  receipts: { id: string; name: string; type: string }[];
  status: ClaimStatus;
  /** Who approved or rejected it, when, and why (for a rejection). */
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** Newest first, with pending claims ahead of decided ones. */
export const byNewest = (a: Claim, b: Claim) =>
  Number(b.status === 'pending') - Number(a.status === 'pending') ||
  b.date.localeCompare(a.date) ||
  b.createdAt.localeCompare(a.createdAt);

/** The total of some claims, to the cent. */
export const claimsTotal = (claims: Claim[]) =>
  Math.round(claims.reduce((s, c) => s + c.amount, 0) * 100) / 100;

/** Claims matching a search over who, what for, category and site. */
export function matchClaim(c: Claim, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [c.claimant, c.purpose, c.category, c.site, c.note]
    .filter(Boolean)
    .some((s) => s!.toLowerCase().includes(q));
}
