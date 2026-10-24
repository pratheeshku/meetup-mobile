/**
 * Match-scoring read model (DES-MEETUP-ADDENDUM-match-scoring v1.2 §4;
 * backend report ms-s4 Appendix A1, `GET /tournaments/{id}/standings`).
 *
 * Everything here is what the backend returned, normalised defensively
 * (unknown or missing fields fall back to a safe empty value). Nothing is
 * computed on the client: ranks, qualification, winners and totals are the
 * backend's (AGENTS.md: never recompute standings).
 */

export type ScoringMatchStage =
  | 'group'
  | 'quarterfinal'
  | 'semifinal'
  | 'final'
  | 'main'
  | 'third_place';

export type ScoringMatchStatus = 'scheduled' | 'completed' | 'walkover' | 'cancelled';

export type ScoringResultType = 'normal' | 'walkover' | 'retired';

/** `group_place`, `winner` or `loser` when the slot has no registration yet. */
export type ScoringPlaceholder = 'group_place' | 'winner' | 'loser';

/**
 * Where an unresolved slot comes from (ms-s5): a group place, or the winner / loser of a feeder match.
 * `match_id` is null only when the backend could not find the feeder.
 */
export type ScoringPlaceholderDetail =
  | { type: 'group_place'; group: string; place: number }
  | { type: 'winner' | 'loser'; match_id: string | null };

export interface ScoringSide {
  registration_id: string | null;
  name: string | null;
  placeholder: ScoringPlaceholder | null;
  /** Null when the slot is resolved (or an older backend did not send it). */
  placeholder_detail: ScoringPlaceholderDetail | null;
  /** True when the signed-in user is the registrant or a roster member of this side (server-computed). */
  is_mine: boolean;
}

/** `GET /tournaments/{id}/scoring/state` (ms-s5): only the fields the app reads. */
export interface TournamentScoringState {
  enabled: boolean;
  applicable: boolean;
  /** Server fact (`registration_phase`): `open`, `committee_only` or `frozen`; null when it cannot be decided. */
  registration_phase?: string | null;
  fixtures_published?: boolean;
  any_result_posted?: boolean;
  /**
   * Tournament-experience AD-T5 (te-b2): the server-computed tab availability. Present for lifecycle version 2
   * tournaments only, so its absence means the legacy page. Never computed on the device.
   */
  tabs?: TournamentTabs | null;
  /** Seconds between refreshes for other viewers (v2 only). */
  live_poll_seconds?: number | null;
}

export type TournamentTabKey = 'overview' | 'participants' | 'fixtures' | 'standings' | 'results' | 'media' | 'approvals';

/** Why a locked tab is locked; the unlock message comes from labels. */
export type TabUnlockCode = 'registration_closes' | 'fixtures_published' | 'play_starts' | 'tournament_closed';

export interface TournamentTabState {
  state: 'open' | 'locked';
  /** Locked tabs only. */
  unlocks?: TabUnlockCode | string;
  /** Approvals only: requests this viewer can decide. */
  badge?: number;
}

/** `approvals` is present only for the organizer and active committee members (the server decides). */
export type TournamentTabs = Partial<Record<TournamentTabKey, TournamentTabState>>;

export interface ScoringSet {
  a: number;
  b: number;
}

export interface ScoringResult {
  result_type: ScoringResultType;
  sets: ScoringSet[];
  advancing_side: 'a' | 'b' | null;
  version: number;
}

export interface ScoringMatch {
  fixture_id: string;
  match_id: string;
  /** Unknown stages are kept as received (shown generically). */
  stage: ScoringMatchStage | string;
  round_number: number;
  fixture_order: number;
  status: ScoringMatchStatus | string;
  /** ISO 8601, or null while unscheduled. */
  scheduled_at: string | null;
  court: string | null;
  side_a: ScoringSide;
  side_b: ScoringSide;
  winner_registration_id: string | null;
  result: ScoringResult | null;
}

export interface ScoringTableRow {
  rank: number;
  tied: boolean;
  registration_id: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  sets_for: number;
  sets_against: number;
  set_diff: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  /**
   * Server-derived (ms-s5): true or false once the group's qualifiers are resolved, null while the group is
   * provisional or has an unresolved tie (show no marker).
   */
  qualifies: boolean | null;
}

export interface ScoringGroup {
  group_key: string;
  complete: boolean;
  provisional: boolean;
  unresolved_tie: boolean;
  needs_override: boolean;
  adjusted_by_committee: boolean;
  qualifiers_resolved: boolean;
  matches_total: number;
  matches_played: number;
  /** Number of qualifiers per group, from the tournament's format. */
  advance_per_group: number;
  table: ScoringTableRow[];
  matches: ScoringMatch[];
}

export interface TournamentStandingsView {
  tournament_id: string;
  published: boolean;
  groups: ScoringGroup[];
  knockout: ScoringMatch[];
  /** The tie-break order the server uses (codes such as `matches_won`); shown as words, never applied here. */
  tiebreakers?: string[];
}
