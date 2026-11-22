/**
 * Bell badge display rule (NB-01), shared by every bell placement:
 * 0 (or less / not a number) = hidden (`null`), 1-99 exact, 100+ = "99+".
 */
export const MAX_BADGE_COUNT = 99;

export function formatBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) {
    return null;
  }
  const whole = Math.floor(count);
  return whole > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(whole);
}
