/** Game duration choices for Create Game step 3 (whole hours, 1-8; default 2). */
export const GAME_DURATION_HOURS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const DEFAULT_GAME_DURATION_HOURS = 2;

const HOUR_MS = 3_600_000;

/** ISO `ends_at` = `starts` + whole hours, as an absolute instant (same UTC form as `starts_at`). */
export function computeEndsAtIso(starts: Date, hours: number): string {
  return new Date(starts.getTime() + hours * HOUR_MS).toISOString();
}
