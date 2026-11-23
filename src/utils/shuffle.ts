/**
 * Random pick for the Home My groups panel (DES-MEETUP-ADDENDUM-priority1-nov23 P1-02): a Fisher-Yates shuffle of a
 * copy, then the first `count`. `random` is injectable so tests are deterministic. The input is never mutated.
 */
export function pickRandom<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, Math.max(0, count));
}
