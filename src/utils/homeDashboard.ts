/**
 * Pure selectors behind the Home dashboard (DES-MEETUP-MOBILE.md §4.3;
 * R-021 "upcoming / mine" grouping). Client-side filtering of the one
 * `getEvents()` response — no new API calls, and nothing the backend
 * returns is recalculated (R-042 spirit): this only partitions and counts.
 *
 * Organiser detection: `Event.is_organiser` is a stub that `mapEventApiItem`
 * always sets to `false` (the endpoint has no such field — see the
 * Proposed Assumptions block in `src/api/events.ts`). Every rule below that
 * needs "does the user organise this?" therefore also compares
 * `organiser_id` with the signed-in user's id, the same derivation
 * `TournamentDetailScreen` already uses. Like all role gating this is a UX
 * convenience only; the backend remains the sole authority (R-017, R-082).
 *
 * Proposed Assumptions (recorded in the Implementation Report):
 * - Events whose status is `cancelled` or `completed` are excluded from
 *   every section, pill and count: "upcoming"/"recommended"/"active" must
 *   not surface an event that can no longer be attended. Unknown status
 *   values pass through.
 * - Sport pills come from the whole loaded feed (not only the user's own
 *   events), so a pill can filter the Recommended section too.
 */
import type { Event } from '../types/event';

/** Max items a dashboard section shows before "View all". */
export const MAX_SECTION_ITEMS = 3;

export const DEFAULT_SPORT_EMOJI = '🎯';

const SPORT_EMOJI: Record<string, string> = {
  badminton: '🏸',
  football: '⚽',
  tennis: '🎾',
  basketball: '🏀',
  volleyball: '🏐',
};

export interface SportOption {
  /** Normalised (trimmed, lower-cased) sport name — the filter identity. */
  key: string;
  /** Display name, first letter of each word upper-cased. */
  label: string;
  emoji: string;
}

/** Filter identity for a raw sport string. */
export function sportKey(sport: string): string {
  return sport.trim().toLowerCase();
}

export function sportEmoji(sport: string): string {
  return SPORT_EMOJI[sportKey(sport)] ?? DEFAULT_SPORT_EMOJI;
}

export function sportLabel(sport: string): string {
  return sport
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Cancelled/completed events can no longer be attended. */
function isAttendable(event: Event): boolean {
  return event.status !== 'cancelled' && event.status !== 'completed';
}

function matchesSport(event: Event, selectedSportKey: string | null): boolean {
  return selectedSportKey === null || sportKey(event.sport) === selectedSportKey;
}

/** `is_organiser` is a stub (always false) — also compare ids. See file header. */
export function isOrganiserOf(event: Event, userId: string | undefined): boolean {
  return event.is_organiser || (Boolean(userId) && event.organiser_id === userId);
}

function startsAtMs(event: Event): number {
  const ms = Date.parse(event.starts_at);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/**
 * One option per distinct sport among attendable events, sorted by label so
 * the pill order does not change with feed order between refreshes. Events
 * with no sport contribute no pill (they still appear under "All").
 */
export function getSportOptions(events: Event[]): SportOption[] {
  const byKey = new Map<string, SportOption>();
  for (const event of events) {
    const key = sportKey(event.sport);
    if (key.length > 0 && isAttendable(event) && !byKey.has(key)) {
      byKey.set(key, { key, label: sportLabel(event.sport), emoji: sportEmoji(event.sport) });
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Attendable events the user has registered for (going / waitlisted),
 * soonest first. Unbounded — the section applies `MAX_SECTION_ITEMS`.
 * `selectedSportKey` `null` means "All".
 */
export function getUpcomingGames(events: Event[], selectedSportKey: string | null): Event[] {
  return events
    .filter(
      event =>
        isAttendable(event) &&
        (event.current_user_rsvp_status === 'going' ||
          event.current_user_rsvp_status === 'waitlisted') &&
        matchesSport(event, selectedSportKey),
    )
    .sort((a, b) => {
      const aMs = startsAtMs(a);
      const bMs = startsAtMs(b);
      // Explicit comparison: Infinity - Infinity is NaN, which would make
      // events with unparseable dates compare inconsistently.
      return aMs === bMs ? 0 : aMs < bMs ? -1 : 1;
    });
}

/**
 * Attendable public events the user has not joined (`rsvp === 'none'`) and
 * does not organise. Feed order is preserved — the brief specifies no
 * ordering, so the backend's is kept rather than inventing one.
 */
export function getRecommendedGames(
  events: Event[],
  userId: string | undefined,
  selectedSportKey: string | null,
): Event[] {
  return events.filter(
    event =>
      isAttendable(event) &&
      event.visibility === 'public' &&
      event.current_user_rsvp_status === 'none' &&
      !isOrganiserOf(event, userId) &&
      matchesSport(event, selectedSportKey),
  );
}

/**
 * "My Games" count: attendable events the user organises or is going to.
 * Deliberately independent of the sport filter (the brief filters only the
 * Upcoming and Recommended sections). Waitlisted does not count — the brief
 * says organises OR `going`.
 */
export function countMyGames(events: Event[], userId: string | undefined): number {
  return events.filter(
    event =>
      isAttendable(event) &&
      (isOrganiserOf(event, userId) || event.current_user_rsvp_status === 'going'),
  ).length;
}
