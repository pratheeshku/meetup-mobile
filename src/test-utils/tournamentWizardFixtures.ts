/** Fixtures for the creation wizard tests, shaped like `GET /tournaments/v2/templates` and the create response. */
import type { WizardCreateResult, WizardTemplate, WizardTemplatesResponse } from '../types/tournamentWizard';

export const GROUP_TEMPLATE: WizardTemplate = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'badminton-groups-knockout',
  version: 4,
  display_name: 'Badminton groups knockout',
  format: {
    algorithm: 'group_stage',
    scoring: 'sets',
    group_stage_options: [{ groups: 4, qualify_per_group: 2, qualifiers: 8 }],
    entrants_min: 8,
    entrants_max: 32,
    team_size_min: 2,
    team_size_max: 4,
    organizer_overrides: [
      { field: 'entrants_min', min: 4, max: 16 },
      { field: 'entrants_max', min: 8, max: 64 },
      { field: 'team_size_min', min: 2, max: 4 },
      { field: 'team_size_max', min: 2, max: 4 },
    ],
  },
};

export const KNOCKOUT_TEMPLATE: WizardTemplate = {
  ...GROUP_TEMPLATE,
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'single-elimination',
  display_name: 'Single elimination',
  version: 3,
  format: { ...GROUP_TEMPLATE.format, algorithm: 'knockout', group_stage_options: [] },
};

export const TEMPLATES: WizardTemplatesResponse = {
  templates: [KNOCKOUT_TEMPLATE, GROUP_TEMPLATE],
  limits: { audience_group_cap: 20, committee_max: 10, min_gap_hours: 0 },
  home_timezone: 'Asia/Singapore',
};

export function createdResult(overrides: Partial<WizardCreateResult> = {}): WizardCreateResult {
  return {
    id: 'tour-1',
    client_request_id: 'req-1',
    title: 'Punggol Open 2026',
    sport: 'badminton',
    participation_mode: 'individual',
    visibility: 'public',
    groups: [],
    template: { id: GROUP_TEMPLATE.id, slug: GROUP_TEMPLATE.slug, version: 4, display_name: GROUP_TEMPLATE.display_name },
    registration_opens_at: '2026-10-14T00:00:00Z',
    registration_closes_at: '2026-10-30T00:00:00Z',
    registration_hard_block_at: '2026-11-03T00:00:00Z',
    starts_at: '2026-11-14T01:00:00Z',
    ends_at: '2026-11-15T10:00:00Z',
    committee: [
      { user_id: 'me', display_name: 'Pratheesh', status: 'active', is_organizer: true },
      { user_id: 'u-ravi', display_name: 'Ravi K.', status: 'invited', is_organizer: false },
    ],
    ...overrides,
  };
}
