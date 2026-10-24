/**
 * Wire shapes of the tab bodies of the tournament page for lifecycle version 2 (te-a2; DES-MEETUP-ADDENDUM-tournament-
 * experience AD-T7, AD-T8, AD-T9, AD-T10; backend reports te-b2 and te-b3). Everything here is what the server returned;
 * the device never sends or computes a winner, a standing or an advancement.
 */
import type { ScoringGroup, ScoringMatch, ScoringSet } from './tournamentScoring';

export type EntryResultType = 'normal' | 'walkover' | 'retired';

/** Body of `POST .../matches/{id}/result` and, without `client_request_id` and `reason`, of `.../result/preview`. No winner, ever. */
export interface MatchResultBody {
  result_type: EntryResultType;
  sets: ScoringSet[];
  advancing_side: 'a' | 'b' | null;
  expected_version: number;
  client_request_id?: string;
  reason?: string;
}

/** A knockout slot the saved score filled, replaced or opened (names, never ids). */
export interface AdvancedSlot {
  match_id: string | null;
  fixture_id: string;
  side: 'A' | 'B';
  name: string | null;
  registration_id: string | null;
  change: string;
}

export interface QualifiedEntry {
  group_key: string;
  place: number;
  registration_id: string;
  name: string;
}

/** The entry response (AD-S13): what the screen re-renders from. */
export interface MatchEntryResponse {
  outcome: string;
  match: ScoringMatch | null;
  standings_delta: ScoringGroup[];
  advanced: AdvancedSlot[];
  qualified: QualifiedEntry[];
  changed_matches: ScoringMatch[];
  bracket_version: number;
}

export type BlockedBy =
  | { code: 'CORRECTION_NEEDS_APPROVAL'; detail: string }
  | { code: 'DOWNSTREAM_PLAYED'; detail: string; matches: { match_id: string | null; stage: string; round_number: number }[] }
  | { code: string; detail: string };

/** `POST .../result/preview`: the impact box. Writes nothing. */
export interface MatchPreview {
  was: ScoringMatch | null;
  will_be: ScoringMatch | null;
  standings_delta: ScoringGroup[];
  advanced: AdvancedSlot[];
  blocked_by: BlockedBy[];
}

/** A coded refusal of the result routes (422 and 409). */
export interface ResultRefusal {
  status: number;
  code: string | null;
  /** Row issue codes of a 422 (`MATCH_TIED` and the shape codes of the validator). */
  issueCodes: string[];
  /** 409 `CORRECTION_NEEDS_APPROVAL`: the proposed change the server asked to send for approval. */
  needsApproval: boolean;
  /** 409 `RESULT_STALE`: the match as it is now. */
  currentMatch: ScoringMatch | null;
}

/** One row of `GET /tournaments/{id}/committee/actions` (ids are used to decide, never shown). */
export interface ApprovalRequest {
  id: string;
  action_type: string;
  command_payload: Record<string, unknown>;
  consequence_description: string;
  initiator_user_id: string;
  approver_user_id: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
  /** Display name of the uploader (never an id). */
  uploaded_by: string | null;
  can_remove: boolean;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
}

/** A stored registration as the Participants tab needs it. */
export interface ParticipantRow {
  id: string;
  user_id: string | null;
  name: string;
  registered_at: string;
}

/** A coded refusal of an upload (422 `POINTS_UPLOAD_INVALID`, `RESULTS_UPLOAD_INVALID`, file codes) or of a setup call. */
export interface UploadRow {
  sheet: string | null;
  row: number | null;
  column: string | null;
  code: string;
  matchId: string | null;
}

export interface UploadRefusal {
  status: number;
  code: string | null;
  detail: string;
  errorCount: number;
  rows: UploadRow[];
}

export interface PointsAccepted {
  entrants: number;
  rated: number;
  unrated: number;
}

export interface ResultsUploadSummary {
  posted: number;
  corrected: number;
  unchanged: number;
}

export interface DraftSide {
  kind: 'entrant' | 'group_place' | 'winner' | 'loser' | 'other';
  entrantId: string | null;
  group: string | null;
  place: number | null;
}

export interface DraftMatch {
  knockout: boolean;
  round: number;
  ordinal: number;
  group: string;
  start: string | null;
  court: string | null;
  a: DraftSide;
  b: DraftSide;
}

/** `GET .../drafts/{id}`: registration ids only; names are filled in at the screen from the participants it loads. */
export interface DraftDetail {
  draftId: string;
  version: number;
  status: string;
  payloadHash: string;
  groups: number | null;
  advance: number | null;
  matchCount: number;
  /** Groups with their entrants in the server's order; `seed` is the entrant's own rank in the draft. */
  groupList: { key: string; members: { entrantId: string; seed: number | null }[] }[];
  groupMatches: number;
  knockoutMatches: number;
  matches: DraftMatch[];
}
