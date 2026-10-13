/**
 * The team: everyone at Maxsen the planner schedules and messages, with their role and WhatsApp
 * number. The timetable assigns appointments from it and messages people on these numbers.
 */

export const TEAM_ROLES = [
  'Sales',
  'Installer',
  'Electrician',
  'Integrator',
  'Delivery',
  'Manager',
  'Office',
] as const;

export interface TeamMember {
  id: string;
  name: string;
  role?: string;
  /** WhatsApp number as typed; see `whatsappNumber` for the checked form. */
  phone?: string;
  email?: string;
  /** YYYY-MM-DD */
  joined?: string;
  notes?: string;
  /** Still with the team: only active people are assigned and messaged. */
  active: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type PhoneCheck =
  | { ok: true; /** Digits with the country code, for wa.me. */ digits: string; display: string }
  | { ok: false; reason: string };

/**
 * A WhatsApp number checked: a Singapore mobile (8 digits starting 8 or 9, +65 added) or an
 * international number with its country code (+60…, 0060…).
 */
export function whatsappNumber(phone: string): PhoneCheck {
  const typed = phone.trim();
  if (!typed) return { ok: false, reason: 'No number' };
  let digits = typed.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  const international = digits.startsWith('+');
  digits = digits.replace(/\D/g, '');
  if (!international && digits.length === 8) {
    if (!/^[89]/.test(digits)) return { ok: false, reason: 'Singapore mobiles start with 8 or 9' };
    digits = `65${digits}`;
  } else if (!international && digits.length === 10 && digits.startsWith('65')) {
    // 65 typed without the +.
  } else if (!international) {
    return { ok: false, reason: 'Add the country code (e.g. +60) for a number outside Singapore' };
  }
  if (digits.startsWith('65')) {
    const local = digits.slice(2);
    if (local.length !== 8 || !/^[89]/.test(local))
      return { ok: false, reason: 'A Singapore mobile is 8 digits starting 8 or 9' };
    return { ok: true, digits, display: `+65 ${local.slice(0, 4)} ${local.slice(4)}` };
  }
  if (digits.length < 8 || digits.length > 15)
    return { ok: false, reason: 'That doesn’t look like a full phone number' };
  return { ok: true, digits, display: `+${digits}` };
}

/** Active members first, then by name. */
export const byName = (a: TeamMember, b: TeamMember) =>
  Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
