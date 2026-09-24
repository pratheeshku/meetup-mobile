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
 *   every section and count: "upcoming"/"recommended"/"active" must
 *   not surface an event that can no longer be attended. Unknown status
 *   values pass through.
 *
 * Sport pills (BUG-M06): pills are sourced from `GET /admin/sports/public`
 * (`getSportOptionsFromAdminSports`), not from the loaded event feed —
 * every admin-defined sport gets a pill regardless of whether the current
 * feed has any events for it. `getSportOptions` (feed-derived) is kept
 * only as a still-tested pure selector / test fixture helper; HomeScreen no
 * longer calls it for the pill row.
 */
import type { Event } from '../types/event';
import type { Sport } from '../types/sport';
import type { SkillLevel } from '../types/user';

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
 *
 * No longer HomeScreen's pill source as of BUG-M06 (see file header) — kept
 * as a pure selector and as the fixture-building helper `homeComponents`
 * tests use for `SportFilterPills`.
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
 * One option per sport returned by `GET /admin/sports/public` (BUG-M06),
 * sorted by label for the same reason `getSportOptions` is: a stable pill
 * order independent of API response order. `getSports()` already filters to
 * `is_active` sports (`src/api/sports.ts`).
 *
 * Label comes straight from the admin `display_name` — the authoritative
 * casing (same field `useSportDisplayName`/BUG-M02 resolves to) — rather
 * than recomputing it from the slug via `sportLabel()`. Emoji reuses the
 * existing `sportEmoji()`/`SPORT_EMOJI` map as-is (architect direction,
 * BUG-M06 unblock): an admin sport outside that map's 5 entries renders
 * with `DEFAULT_SPORT_EMOJI` ('🎯') — accepted, not a defect, for this
 * ticket's scope.
 */
export function getSportOptionsFromAdminSports(sports: Sport[]): SportOption[] {
  return sports
    .map(sport => ({
      key: sportKey(sport.name),
      label: sport.display_name,
      emoji: sportEmoji(sport.name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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

/** Shared "My Games" predicate: attendable events the user organises or is going to. */
function isMyGame(event: Event, userId: string | undefined): boolean {
  return (
    isAttendable(event) &&
    (isOrganiserOf(event, userId) || event.current_user_rsvp_status === 'going')
  );
}

const SKILL_TIER: Record<string, number> = {
  expert: 3,
  intermediate: 2,
  beginner: 1,
};

/** 0 for an unrecognised/malformed `skill_level` value — never guessed. */
function skillTier(skillLevel: string): number {
  return SKILL_TIER[skillLevel.trim().toLowerCase()] ?? 0;
}

/**
 * `updated_at` is optional/unverified on this endpoint (see `SkillLevel` in
 * `src/types/user.ts`) — a row missing or with an unparseable value sorts as
 * older than any row with a valid one, so it only wins a tie against other
 * equally-unparseable rows (Proposed Assumption).
 */
function updatedAtMs(row: SkillLevel): number {
  const ms = row.updated_at ? Date.parse(row.updated_at) : NaN;
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/**
 * Home screen sport-filter pre-selection default
 * (ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001 §3,
 * R-MOBILE-SPORTS-FILTER-PRESELECT-1). Ranks the caller's skill-level rows
 * by tier (expert > intermediate > beginner): a single top-tier sport is
 * pre-selected; a tie at the top tier is broken by the most recently
 * updated row. Zero rows — or rows that are all an unrecognised tier —
 * leaves the default at `null` ("All"), unchanged from today.
 *
 * Returns a normalised `sportKey()`, matching `SportOption.key` — the
 * caller (`HomeScreen`) is responsible for falling back to `null` if the
 * returned key has no corresponding pill actually rendered (as of BUG-M06,
 * `getSportOptionsFromAdminSports(adminSports)` — the admin sports list,
 * not the event feed); this function only knows about skill levels, not
 * the current admin sports list or event feed.
 */
export function getPreselectedSportKey(skillLevels: SkillLevel[]): string | null {
  let topTier = 0;
  for (const row of skillLevels) {
    const tier = skillTier(row.skill_level);
    if (tier > topTier) {
      topTier = tier;
    }
  }
  if (topTier === 0) {
    return null;
  }

  const topRows = skillLevels.filter(row => skillTier(row.skill_level) === topTier);
  let winner = topRows[0];
  for (const row of topRows.slice(1)) {
    if (updatedAtMs(row) > updatedAtMs(winner)) {
      winner = row;
    }
  }
  return sportKey(winner.sport);
}

/**
 * "My Games" count: attendable events the user organises or is going to.
 * Deliberately independent of the sport filter (the brief filters only the
 * Upcoming and Recommended sections). Waitlisted does not count — the brief
 * says organises OR `going`.
 */
export function countMyGames(events: Event[], userId: string | undefined): number {
  return events.filter(event => isMyGame(event, userId)).length;
}

/**
 * The events behind the "My Games" count (BUG-M04), soonest first — same
 * `isMyGame` predicate as `countMyGames`, feeding the tile's filtered view
 * instead of just its number.
 */
export function getMyGames(events: Event[], userId: string | undefined): Event[] {
  return events.filter(event => isMyGame(event, userId)).sort((a, b) => {
    const aMs = startsAtMs(a);
    const bMs = startsAtMs(b);
    return aMs === bMs ? 0 : aMs < bMs ? -1 : 1;
  });
}
