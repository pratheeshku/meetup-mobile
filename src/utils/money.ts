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
