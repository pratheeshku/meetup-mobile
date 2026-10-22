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

export interface ScoringSide {
  registration_id: string | null;
  name: string | null;
  placeholder: ScoringPlaceholder | null;
}

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
  table: ScoringTableRow[];
  matches: ScoringMatch[];
}

export interface TournamentStandingsView {
  tournament_id: string;
  published: boolean;
  groups: ScoringGroup[];
  knockout: ScoringMatch[];
}
