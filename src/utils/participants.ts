/**
 * Participants screen helpers (DES-MEETUP-ADDENDUM-teams-payments AD-9 to AD-13). Everything the screen counts or adds up is the server's (`summary`);
 * nothing here recomputes paid, unpaid, cash collected or the excluded number. Only filtering rows by the server's `payment_received_at` and reading a
 * typed points value live here.
 */
import type { ParticipantRow } from '../types/tournamentTabs';

export type PaymentFilter = 'all' | 'paid' | 'unpaid';

/** `exempt` = the organizer's own entry (no payment); `paid` = the organizer confirmed; else `unpaid`. */
export type PaymentState = 'exempt' | 'paid' | 'unpaid';

export function paymentStateOf(row: Pick<ParticipantRow, 'payment_exempt' | 'payment_received_at'>): PaymentState {
  if (row.payment_exempt) {
    return 'exempt';
  }
  return row.payment_received_at ? 'paid' : 'unpaid';
}

/** All, Paid, Unpaid. The organizer's own entry shows under All only. */
export function filterByPayment<T extends Pick<ParticipantRow, 'payment_exempt' | 'payment_received_at'>>(rows: T[], filter: PaymentFilter): T[] {
  if (filter === 'all') {
    return rows;
  }
  const wanted: PaymentState = filter;
  return rows.filter(row => paymentStateOf(row) === wanted);
}

export type ParsedPoints = { valid: true; value: number | null } | { valid: false };

/** What the points box holds as a request value: empty = unrated (null); a plain number with up to six decimals; anything else is invalid. */
export function parsePointsInput(text: string): ParsedPoints {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { valid: true, value: null };
  }
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    return { valid: false };
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? { valid: true, value } : { valid: false };
}

/** The points box shows the server's text, trimmed of trailing zeros ("1450.000000" -> "1450"); null reads as empty. */
export function pointsText(points: string | null | undefined): string {
  if (points === null || points === undefined || points === '') {
    return '';
  }
  return points.includes('.') ? points.replace(/0+$/, '').replace(/\.$/, '') : points;
}

/** Keeps digits and one dot while typing. */
export function sanitizePointsTyping(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  return firstDot === -1 ? cleaned : `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
}
