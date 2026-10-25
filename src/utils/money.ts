/**
 * The one place a fee is turned into text (DES-MEETUP-ADDENDUM-tournament-registration AD-4). The amount arrives as whole cents plus a
 * currency code from the server; nothing is recomputed or converted here, only formatted.
 */
export function formatMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    // An engine without Intl, or a code it does not know: plain code and two decimals.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** True for a fee that asks for something: whole cents above zero. Null, zero and anything else read as free. */
export function hasFee(cents: number | null | undefined): cents is number {
  return typeof cents === 'number' && Number.isFinite(cents) && cents > 0;
}

/** `{ valid: true, cents: null }` for an empty field (no fee); `{ valid: false }` for anything that is not a plain amount. */
export type ParsedAmount = { valid: true; cents: number | null } | { valid: false };

/**
 * An amount typed in the config currency (for example "15", "15.5", "15.00") to whole cents (1500, 1550, 1500), for the request.
 * A dot is the only decimal separator; more than two decimals, a sign, spaces inside, exponents, commas and anything non-numeric are
 * invalid. Done with integer arithmetic on the digits, never a float multiply.
 */
export function parseAmountToCents(text: string): ParsedAmount {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { valid: true, cents: null };
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    return { valid: false };
  }
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  return Number.isSafeInteger(cents) ? { valid: true, cents } : { valid: false };
}

/** Stored whole cents shown as an editable amount ("15.00"). */
export function centsToAmountText(cents: number): string {
  return (cents / 100).toFixed(2);
}
