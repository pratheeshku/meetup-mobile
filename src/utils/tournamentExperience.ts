/**
 * Pure helpers of the tournament page for lifecycle version 2 (DES-MEETUP-ADDENDUM-tournament-experience AD-T5, AD-T6).
 * Nothing here decides status, tab openness, winners or banner tone: those are the server's. This file only maps
 * what the server sent (`lifecycle_status`, `registration_phase`, `fixtures_published`, `tabs`, `banner_tone`) to the
 * words and glyph states of the boards.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { TabUnlockCode, TournamentTabKey, TournamentTabs } from '../types/tournamentScoring';
import type { BannerTone, TournamentPerson } from '../types/tournament';

export type StageKey = 'registration' | 'fixtures' | 'play' | 'results';
export type StageState = 'done' | 'current' | 'upcoming';
export const STAGE_ORDER: readonly StageKey[] = ['registration', 'fixtures', 'play', 'results'];

export const STAGE_LABEL: Record<StageKey, LabelKey> = {
  registration: 'mob.tournament.v2.stage_registration',
  fixtures: 'mob.tournament.v2.stage_fixtures',
  play: 'mob.tournament.v2.stage_play',
  results: 'mob.tournament.v2.stage_results',
};

export type PillDot = 'open' | 'closed' | 'live' | 'done' | 'none';

export interface StripModel {
  pill: LabelKey;
  dot: PillDot;
  /** Second chip next to the pill (board TV2MobClosedOverview), or null. */
  chip: LabelKey | null;
  /** Null when the stepper is not drawn (cancelled, or the phase is unknown). */
  stages: Record<StageKey, StageState> | null;
}

export interface StripInput {
  lifecycle: string | undefined;
  closureOutcome?: string | null;
  /**
   * `registration_phase` of the scoring state: `open` or `closed` for a participant (A39), `open`, `committee_only` or `frozen`
   * for the committee; null when it could not be read. Any other value is read through `registrationOpen`.
   */
  phase: string | null;
  fixturesPublished: boolean;
  /** `registration_open` as the API returned it (never recomputed here); used when `phase` is null or not one of the known values. */
  registrationOpen?: boolean | null;
}

/**
 * `open` or `closed` from the server's phase (A39). A phase this build does not know falls back to the API's
 * `registration_open`, and to `closed` when that is absent too, so the page never draws an empty status block. Null only
 * when the phase is null and `registration_open` was not given.
 */
export function registrationStage(phase: string | null, registrationOpen?: boolean | null): 'open' | 'closed' | null {
  if (phase === 'open') {
    return 'open';
  }
  if (phase === 'closed' || phase === 'committee_only' || phase === 'frozen') {
    return 'closed';
  }
  if (typeof registrationOpen === 'boolean') {
    return registrationOpen ? 'open' : 'closed';
  }
  return phase === null ? null : 'closed';
}

function stages(done: StageKey[], current: StageKey | null): Record<StageKey, StageState> {
  const out = {} as Record<StageKey, StageState>;
  for (const key of STAGE_ORDER) {
    out[key] = done.includes(key) ? 'done' : key === current ? 'current' : 'upcoming';
  }
  return out;
}

/** Status pill, chip and stepper from server facts. */
export function stripModel(input: StripInput): StripModel {
  if (input.lifecycle === 'cancelled') {
    return { pill: 'mob.closure.status.cancelled', dot: 'none', chip: null, stages: null };
  }
  if (input.lifecycle === 'closed') {
    return {
      pill: input.closureOutcome === 'not_held' ? 'mob.closure.status.not_held' : 'mob.tournament.v2.pill_completed',
      dot: 'done',
      chip: null,
      stages: stages(['registration', 'fixtures', 'play', 'results'], null),
    };
  }
  if (input.fixturesPublished) {
    if (input.lifecycle === 'past') {
      return {
        pill: 'mob.closure.status.pending',
        dot: 'live',
        chip: null,
        stages: stages(['registration', 'fixtures', 'play'], 'results'),
      };
    }
    return {
      pill: 'mob.tournament.v2.pill_in_progress',
      dot: 'live',
      chip: null,
      stages: stages(['registration', 'fixtures'], 'play'),
    };
  }
  const stage = registrationStage(input.phase, input.registrationOpen);
  if (stage === 'open') {
    return { pill: 'mob.tournament.v2.pill_registration_open', dot: 'open', chip: null, stages: stages([], 'registration') };
  }
  if (stage === 'closed') {
    return {
      pill: 'mob.tournament.v2.pill_registration_closed',
      dot: 'closed',
      chip: 'mob.tournament.v2.chip_fixtures_preparing',
      stages: stages(['registration'], 'fixtures'),
    };
  }
  return { pill: 'mob.closure.status.active', dot: 'none', chip: null, stages: null };
}

/**
 * Text tone and scrim of the status strip, as the server stored them. A tournament without a picture, and a server
 * that sent neither, show the built-in values (te-b1 report: light text, scrim 40), never a value computed here.
 */
export function stripTone(tone: BannerTone | null | undefined, scrim: number | null | undefined): { tone: BannerTone; scrim: number } {
  const safeScrim = typeof scrim === 'number' && scrim >= 0 && scrim <= 60 ? scrim : 40;
  return { tone: tone === 'dark' ? 'dark' : 'light', scrim: tone === 'dark' || tone === 'light' ? safeScrim : 40 };
}

export type OverviewKind = 'open' | 'closed' | 'live' | 'done' | 'cancelled' | 'unknown';

/** Which Overview the page shows, from the same server facts as the strip. `live` has no board (see the te-a1 report). */
export function overviewKind(input: StripInput): OverviewKind {
  if (input.lifecycle === 'cancelled') {
    return 'cancelled';
  }
  if (input.lifecycle === 'closed') {
    return 'done';
  }
  if (input.fixturesPublished) {
    return 'live';
  }
  const stage = registrationStage(input.phase, input.registrationOpen);
  return stage ?? 'unknown';
}

export interface KeyDateStates {
  opened: StageState;
  soft: StageState;
  hard: StageState;
  fixtures: StageState;
  days: StageState;
}

/**
 * Glyph state of the rows of "Key dates" per Overview kind (server facts only, no date arithmetic). `rosterFrozen` is
 * the server's `roster_frozen_at` (set only once the hard block has passed): it decides the hard block row.
 */
export function keyDateStates(kind: OverviewKind, rosterFrozen = false): KeyDateStates {
  switch (kind) {
    case 'open':
      return { opened: 'done', soft: 'current', hard: 'upcoming', fixtures: 'upcoming', days: 'upcoming' };
    case 'closed':
      return rosterFrozen
        ? { opened: 'done', soft: 'done', hard: 'done', fixtures: 'current', days: 'upcoming' }
        : { opened: 'done', soft: 'done', hard: 'current', fixtures: 'upcoming', days: 'upcoming' };
    case 'live':
      return { opened: 'done', soft: 'done', hard: 'done', fixtures: 'done', days: 'current' };
    case 'done':
      return { opened: 'done', soft: 'done', hard: 'done', fixtures: 'done', days: 'done' };
    default:
      return { opened: 'upcoming', soft: 'upcoming', hard: 'upcoming', fixtures: 'upcoming', days: 'upcoming' };
  }
}

// ---- tabs ------------------------------------------------------------------------------------------------
export const TAB_ORDER: readonly TournamentTabKey[] = ['overview', 'participants', 'fixtures', 'standings', 'results', 'media'];

export interface TabEntry {
  key: TournamentTabKey;
  locked: boolean;
  unlocks: TabUnlockCode | string | null;
  badge: number | null;
}

/**
 * The tabs to draw, from the server `tabs` object only: its six fixed tabs in order, then Approvals only when the
 * server sent it. A tab the server left out is not drawn.
 */
export function tabEntries(tabs: TournamentTabs): TabEntry[] {
  const keys: TournamentTabKey[] = [...TAB_ORDER, ...(tabs.approvals ? (['approvals'] as TournamentTabKey[]) : [])];
  return keys
    .filter(key => tabs[key] !== undefined)
    .map(key => {
      const entry = tabs[key]!;
      return {
        key,
        locked: entry.state === 'locked',
        unlocks: entry.state === 'locked' ? entry.unlocks ?? null : null,
        badge: typeof entry.badge === 'number' ? entry.badge : null,
      };
    });
}

const UNLOCK_LABELS: Record<string, LabelKey> = {
  registration_closes: 'mob.tournament.tabs.locked.registration_closes',
  fixtures_published: 'mob.tournament.tabs.locked.fixtures_published',
  play_starts: 'mob.tournament.tabs.locked.play_starts',
  tournament_closed: 'mob.tournament.tabs.locked.tournament_closed',
};

/** Unlock message key for a code; an unknown code falls back to the generic locked title. */
export function unlockLabelKey(code: string | null | undefined): LabelKey {
  return (code && UNLOCK_LABELS[code]) || 'mob.tournament.tabs.locked_title';
}

// ---- people ----------------------------------------------------------------------------------------------
/** "Alicia, Joyce +1": the first `shown` names then the rest as a count. Names only, never ids. */
export function committeeNames(people: readonly TournamentPerson[], shown = 2): string {
  const names = people.map(person => person.display_name);
  if (names.length <= shown) {
    return names.join(', ');
  }
  return `${names.slice(0, shown).join(', ')} +${names.length - shown}`;
}

// ---- dates -----------------------------------------------------------------------------------------------
/** "Sat 14 Nov" */
export function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Sat 14 – Sun 15 Nov" (one month), "Sat 14 Nov – Tue 1 Dec" (two months), "Sat 14 Nov" (one day). */
export function formatDateRange(startIso: string, endIso: string | null | undefined): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  if (!end || Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) {
    return formatDayShort(startIso);
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (!sameMonth) {
    return `${formatDayShort(startIso)} – ${formatDayShort(endIso as string)}`;
  }
  const first = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  return `${first} – ${formatDayShort(endIso as string)}`;
}

/** "9:00 AM" */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Number of tournament days for the Results summary: the span of the two server dates, counted in whole days (at least 1). */
export function dayCount(startIso: string, endIso: string | null | undefined): number | null {
  const start = Date.parse(startIso);
  const end = endIso ? Date.parse(endIso) : NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}
