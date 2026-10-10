/**
 * The ONE shared module behind the Home dashboard and the Games screen:
 * list definitions, ordering, scope and sport filtering
 * (DES-MEETUP-ADDENDUM-dashboard.md AD-7, AD-9, AD-14, AD-15).
 * Replaces the former `homeDashboard.ts` selectors (their rules are
 * superseded by AD-14; `ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001`'s
 * single "top-tier" default is superseded by AD-9's "all skill sports").
 *
 * Pure functions only — no I/O, nothing the backend returns is
 * recalculated (R-042 spirit): this partitions, filters and orders.
 *
 * Definitions (AD-14), all over events that start in the future and are
 * not cancelled:
 * - My games   = the user organises it, or is going / waitlisted.
 * - Open games = public, not organised by the user, `rsvp === 'none'`.
 *   (Declined/withdrawn games carry a non-`none` status and are excluded;
 *   see the Implementation Report for the unverified `null` case.)
 * - Order: `starts_at` ascending, ties by `created_at` ascending.
 *
 * Organiser detection: `Event.is_organiser` is a stub the API mapper always
 * sets to `false`, so organiser checks also compare `organiser_id` with the
 * signed-in user's id. UX convenience only — the backend is the authority
 * (R-017, R-082).
 */
import type { Event } from '../types/event';
import type { Sport } from '../types/sport';
import type { SkillLevel } from '../types/user';
import { bundledT } from '../labels/LabelsContext';
import type { TranslateFn } from '../labels/LabelsContext';

/** Rows a Home section shows before "View all" (AD-14). */
export const HOME_SECTION_ROWS = 2;

export type GameBadge = 'Hosting' | 'Going' | 'Waitlisted' | 'Open';
export type GamesScope = 'all' | 'mine' | 'open';

/** `is_organiser` is a stub (always false) — also compare ids. */
export function isOrganiserOf(event: Event, userId: string | undefined): boolean {
  return event.is_organiser || (Boolean(userId) && event.organiser_id === userId);
}

function parseMs(value: string | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  return Date.parse(value);
}

/** Future (strictly after `now`) and not cancelled (AD-14). */
export function isUpcomingActive(event: Event, now: number): boolean {
  const startsAt = parseMs(event.starts_at);
  return !Number.isNaN(startsAt) && startsAt > now && event.status !== 'cancelled';
}

/** Earliest start first; ties by creation time; unparseable dates last. */
export function compareGames(a: Event, b: Event): number {
  const aStart = parseMs(a.starts_at);
  const bStart = parseMs(b.starts_at);
  const aKey = Number.isNaN(aStart) ? Number.POSITIVE_INFINITY : aStart;
  const bKey = Number.isNaN(bStart) ? Number.POSITIVE_INFINITY : bStart;
  if (aKey !== bKey) {
    return aKey < bKey ? -1 : 1;
  }
  const aCreated = parseMs(a.created_at);
  const bCreated = parseMs(b.created_at);
  const aCreatedKey = Number.isNaN(aCreated) ? Number.POSITIVE_INFINITY : aCreated;
  const bCreatedKey = Number.isNaN(bCreated) ? Number.POSITIVE_INFINITY : bCreated;
  if (aCreatedKey === bCreatedKey) {
    return 0;
  }
  return aCreatedKey < bCreatedKey ? -1 : 1;
}

export function isMyGame(event: Event, userId: string | undefined): boolean {
  return (
    isOrganiserOf(event, userId) ||
    event.current_user_rsvp_status === 'going' ||
    event.current_user_rsvp_status === 'waitlisted'
  );
}

export function isOpenGame(event: Event, userId: string | undefined): boolean {
  return (
    event.visibility === 'public' &&
    !isOrganiserOf(event, userId) &&
    event.current_user_rsvp_status === 'none'
  );
}

/** One badge per row: Hosting > Going > Waitlisted > Open; `null` otherwise. */
export function getGameBadge(event: Event, userId: string | undefined): GameBadge | null {
  if (isOrganiserOf(event, userId)) {
    return 'Hosting';
  }
  if (event.current_user_rsvp_status === 'going') {
    return 'Going';
  }
  if (event.current_user_rsvp_status === 'waitlisted') {
    return 'Waitlisted';
  }
  return isOpenGame(event, userId) ? 'Open' : null;
}

/** Normalised (trimmed, lower-cased) sport identity used by the chips. */
export function sportKey(sport: string | null | undefined): string {
  return (sport ?? '').trim().toLowerCase();
}

/** `[]` means "All" (no sport filter). */
function matchesSports(event: Event, sportKeys: readonly string[]): boolean {
  return sportKeys.length === 0 || sportKeys.includes(sportKey(event.sport));
}

export interface GameListOptions {
  userId: string | undefined;
  /** Selected sport keys; `[]` = All. */
  sportKeys?: readonly string[];
  /** Epoch ms; injectable for tests. */
  now?: number;
}

function select(
  events: readonly Event[],
  predicate: (event: Event) => boolean,
  { sportKeys = [], now = Date.now() }: GameListOptions,
): Event[] {
  return events
    .filter(event => isUpcomingActive(event, now) && predicate(event) && matchesSports(event, sportKeys))
    .sort(compareGames);
}

export function selectMyGames(events: readonly Event[], options: GameListOptions): Event[] {
  return select(events, event => isMyGame(event, options.userId), options);
}

export function selectOpenGames(events: readonly Event[], options: GameListOptions): Event[] {
  return select(events, event => isOpenGame(event, options.userId), options);
}

/** The Games screen list: My games ∪ Open games by scope (AD-15). */
export function selectGames(
  events: readonly Event[],
  scope: GamesScope,
  options: GameListOptions,
): Event[] {
  const { userId } = options;
  return select(
    events,
    event =>
      scope === 'mine'
        ? isMyGame(event, userId)
        : scope === 'open'
          ? isOpenGame(event, userId)
          : isMyGame(event, userId) || isOpenGame(event, userId),
    options,
  );
}

/**
 * The next-game card (AD-7): the soonest game the user is registered for
 * (organises, going or waitlisted); when a sport filter is active, the
 * soonest matching one.
 */
export function selectNextGame(events: readonly Event[], options: GameListOptions): Event | null {
  return selectMyGames(events, options)[0] ?? null;
}

/** Tile count: the size of the unfiltered My games set (AD-14). */
export function countMyGames(
  events: readonly Event[],
  userId: string | undefined,
  now: number = Date.now(),
): number {
  return selectMyGames(events, { userId, now }).length;
}

// ---------------------------------------------------------------------------
// Sport chips (AD-9)
// ---------------------------------------------------------------------------

export interface SportOption {
  /** Filter identity: normalised admin sport `name`. */
  key: string;
  /** Admin `display_name` (authoritative casing). */
  label: string;
  /** Admin `slug`, falling back to `name`, for matching events. */
  slug: string;
  /** Bundled glyph id from the sports API. Null when the API omits it. */
  icon_key: string | null;
  /** API colour. Null when the API omits it. */
  color: string | null;
}

/** One option per active admin sport, sorted by label for a stable chip order. */
export function getSportOptions(sports: readonly Sport[]): SportOption[] {
  return sports
    .map(sport => ({
      key: sportKey(sport.name),
      label: sport.display_name,
      slug: sportKey(sport.slug ?? sport.name),
      icon_key: sport.icon_key ?? null,
      color: sport.color ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Tapping a sport chip toggles it; clearing every sport selects All; tapping
 * All (`null`) clears the others. All is represented as `[]`.
 */
export function toggleSportSelection(
  selection: readonly string[],
  tapped: string | null,
): string[] {
  if (tapped === null) {
    return [];
  }
  return selection.includes(tapped)
    ? selection.filter(key => key !== tapped)
    : [...selection, tapped];
}

/**
 * The first-render default (AD-9): the sports the user has a skill level
 * for that also appear in the admin list; `[]` (All) when none.
 */
export function getDefaultSportSelection(
  skillLevels: readonly SkillLevel[],
  options: readonly SportOption[],
): string[] {
  const available = new Set(options.map(option => option.key));
  const picked: string[] = [];
  for (const row of skillLevels) {
    const key = sportKey(row.sport);
    if (available.has(key) && !picked.includes(key)) {
      picked.push(key);
    }
  }
  return picked;
}

/**
 * Selection actually applied: keys no longer in the admin list (a sport
 * deactivated between loads) are ignored, falling back to All when none
 * remain. Derived — the stored selection is never rewritten.
 */
export function effectiveSportSelection(
  selection: readonly string[],
  options: readonly SportOption[],
): string[] {
  const available = new Set(options.map(option => option.key));
  return selection.filter(key => available.has(key));
}

function joinNames(names: readonly string[], t: TranslateFn): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} ${t('mob.common.and')} ${names[names.length - 1]}`;
}

/** Filtered-empty copy (AD-9). */
export function filteredEmptyMessage(
  selection: readonly string[],
  options: readonly SportOption[],
  t: TranslateFn = bundledT,
): string {
  const names = selection.map(key => options.find(option => option.key === key)?.label ?? key);
  return t('mob.dashboard.filtered_empty', { sports: joinNames(names, t) });
}
