/**
 * Tournament creation wizard wire types (DES-MEETUP-ADDENDUM-tournament-lifecycle AD-20).
 * Read from the backend contract: `tournaments/create_contract.py` (`WizardCreateBody`,
 * `template_summary`), `tournaments/template_router.py` (`GET /tournaments/v2/templates`,
 * `POST /tournaments/v2/create`) and `tournaments/service.py::wizard_response`.
 */
import type { OthersVenueInput } from './venue';

/** The only fields a template can let the organizer change (`OVERRIDABLE_FIELDS`). */
export type WizardOverrideField = 'entrants_min' | 'entrants_max' | 'team_size_min' | 'team_size_max';

export interface WizardTemplateOverride {
  field: string;
  min: number;
  max: number;
}

export interface WizardGroupStageOption {
  groups: number | null;
  qualify_per_group: number | null;
  qualifiers: number;
}

export interface WizardTemplate {
  id: string;
  slug: string;
  version: number;
  display_name: string;
  format: {
    algorithm: string | null;
    scoring: string | null;
    group_stage_options: WizardGroupStageOption[];
    entrants_min: number | null;
    entrants_max: number | null;
    team_size_min: number | null;
    team_size_max: number | null;
    organizer_overrides: WizardTemplateOverride[];
  };
}

export interface WizardLimits {
  audience_group_cap: number;
  committee_max: number;
  /** Always 0 now: the minimum gap is gone (AD-T4). Kept optional so an older answer still parses; never read. */
  min_gap_hours?: number;
}

/** `GET /tournaments/v2/templates`. `{ templates: [] }` alone while the v2 flag is off. */
export interface WizardTemplatesResponse {
  templates: WizardTemplate[];
  limits?: WizardLimits;
  home_timezone?: string;
}

export type WizardVisibility = 'public' | 'group' | 'invite';
export type WizardParticipation = 'individual' | 'team';

/** `POST /tournaments/v2/create` body. `extra="forbid"` on the server: send nothing else. */
export interface WizardCreateBody {
  client_request_id: string;
  /** Never sent (AD-T3): the server uses the single default format. */
  template_id?: string;
  overrides?: Partial<Record<WizardOverrideField, number>>;
  title: string;
  sport: string;
  description?: string;
  participation_mode: WizardParticipation;
  visibility: WizardVisibility;
  venue_id?: string;
  others?: OthersVenueInput;
  venue_name?: string;
  venue_address?: string;
  starts_at: string;
  ends_at: string;
  registration_closes_at: string;
  registration_hard_block_at: string;
  group_ids?: string[];
  committee_member_ids: string[];
}

export interface WizardCommitteeRow {
  user_id: string;
  display_name: string;
  status: string;
  is_organizer: boolean;
}

/** 201 (new) or 200 (replay of the same `client_request_id`): the stored tournament read back. */
export interface WizardCreateResult {
  id: string;
  client_request_id: string | null;
  title: string;
  sport: string;
  participation_mode: WizardParticipation;
  visibility: WizardVisibility;
  groups: { id: string; name: string }[];
  template: { id: string; slug: string; version: number; display_name: string } | null;
  registration_opens_at: string;
  registration_closes_at: string;
  registration_hard_block_at: string;
  starts_at: string;
  ends_at: string;
  committee: WizardCommitteeRow[];
}

/** Rejection body: `{detail, code, field?, reason?, step?, group_id?, user_id?}` (`CreateRejected.body`). */
export interface WizardRejection {
  detail?: unknown;
  code?: string;
  field?: string;
  reason?: string;
  step?: number;
  group_id?: string;
  user_id?: string;
}
