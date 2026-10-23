/**
 * Creation wizard logic (AD-20), kept free of React so it is testable on its own: step numbers, the per-step
 * validation, the client mirror of the five server date rules, the request body, and the mapping of a server
 * rejection to the wizard step and field the boards show. The server stays the only authority (AD-20): nothing is
 * adjusted silently and a server rejection always wins over what the client believed.
 *
 * Board order (390x844 boards, "Step n of 8"): 1 Basics, 2 Format, 3 Participation, 4 When and where,
 * 5 Registration dates, 6 Who can see it, 7 Committee, 8 Review. The server numbers AD-20's own seven steps
 * (`create_contract.STEP_*`), so `step` in a rejection is translated here, never shown.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { OthersVenueInput } from '../types/venue';
import type {
  WizardCreateBody,
  WizardLimits,
  WizardOverrideField,
  WizardParticipation,
  WizardRejection,
  WizardTemplate,
  WizardTemplatesResponse,
} from '../types/tournamentWizard';
import { localDateTimeToDate } from './localDateTime';

export const WIZARD_STEP = {
  basics: 1,
  format: 2,
  participation: 3,
  when: 4,
  registration: 5,
  visibility: 6,
  committee: 7,
  review: 8,
} as const;
export const WIZARD_TOTAL_STEPS = 8;

/** Server defaults when `limits` is absent (`create_contract.DEFAULT_*`). Read from the server whenever it sends them. */
export const FALLBACK_LIMITS: WizardLimits = { audience_group_cap: 20, committee_max: 10, min_gap_hours: 72 };

export const TITLE_MAX = 150;
export const DESCRIPTION_MAX = 5000;

export interface WizardVenue {
  /** Catalogue venue (`venue_id`) or the "Others" form; null id with `othersInput` = Others. */
  venueId: string | null;
  othersInput?: OthersVenueInput;
  name: string;
  address: string;
}

export interface WizardCommitteePerson {
  id: string;
  displayName: string;
}

/** Everything the organizer has entered. Lives in the client only (BP-12): leaving discards it. */
export interface WizardState {
  /** One per wizard session (AD-20), reused on every retry of the same submit. */
  clientRequestId: string;
  sport: string;
  title: string;
  description: string;
  templateId: string | null;
  participation: WizardParticipation;
  /** Player (individual) or team (team) count range. */
  entrantsMin: number | null;
  entrantsMax: number | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  /** "YYYY-MM-DD HH:mm" in the device's local time, as the shared date-time field emits. */
  startsAt: string;
  endsAt: string;
  closesAt: string;
  hardBlockAt: string;
  /** The hard block follows the closure value until the organizer sets it (AD-20). */
  hardBlockTouched: boolean;
  venue: WizardVenue | null;
  /** Catalogue-off venue text. */
  venueName: string;
  venueAddress: string;
  /** Board "Public / Private". Private with groups = `group`; private with none = `invite`. */
  isPrivate: boolean;
  groupIds: string[];
  committee: WizardCommitteePerson[];
}

export function initialWizardState(clientRequestId: string, sport = ''): WizardState {
  return {
    clientRequestId,
    sport,
    title: '',
    description: '',
    templateId: null,
    participation: 'individual',
    entrantsMin: null,
    entrantsMax: null,
    teamSizeMin: null,
    teamSizeMax: null,
    startsAt: '',
    endsAt: '',
    closesAt: '',
    hardBlockAt: '',
    hardBlockTouched: false,
    venue: null,
    venueName: '',
    venueAddress: '',
    isPrivate: false,
    groupIds: [],
    committee: [],
  };
}

/** A validation message: a label key plus its params, and the field it belongs under. */
export interface WizardIssue {
  key: LabelKey;
  params?: Record<string, string | number>;
  field?: string;
  /** Step the issue belongs to (board numbering). */
  step: number;
}

// ---- templates -------------------------------------------------------------------------------------------
/** Groups + knockout is the only format this build offers (task tl-c-mobile-2). */
export const GROUP_STAGE_ALGORITHM = 'group_stage';

export function listableTemplates(response: WizardTemplatesResponse | null | undefined): WizardTemplate[] {
  return (response?.templates ?? []).filter(item => item.format?.algorithm === GROUP_STAGE_ALGORITHM);
}

export function findTemplate(templates: readonly WizardTemplate[], id: string | null): WizardTemplate | null {
  return templates.find(item => item.id === id) ?? null;
}

export function overrideLimits(template: WizardTemplate | null, field: WizardOverrideField): { min: number; max: number } | null {
  const hit = template?.format.organizer_overrides.find(item => item.field === field);
  return hit ? { min: hit.min, max: hit.max } : null;
}

/** The template's own value for a field. */
export function templateDefault(template: WizardTemplate, field: WizardOverrideField): number | null {
  return template.format[field] ?? null;
}

/** Entering Participation or choosing a template starts each count at the template's own value. */
export function applyTemplateDefaults(state: WizardState, template: WizardTemplate | null): WizardState {
  if (!template) {
    return { ...state, templateId: null, entrantsMin: null, entrantsMax: null, teamSizeMin: null, teamSizeMax: null };
  }
  return {
    ...state,
    templateId: template.id,
    entrantsMin: templateDefault(template, 'entrants_min'),
    entrantsMax: templateDefault(template, 'entrants_max'),
    teamSizeMin: templateDefault(template, 'team_size_min'),
    teamSizeMax: templateDefault(template, 'team_size_max'),
  };
}

/** Only the fields the template lists AND the organizer changed travel as overrides. */
export function buildOverrides(state: WizardState, template: WizardTemplate): Partial<Record<WizardOverrideField, number>> {
  const out: Partial<Record<WizardOverrideField, number>> = {};
  const entries: [WizardOverrideField, number | null][] = [
    ['entrants_min', state.entrantsMin],
    ['entrants_max', state.entrantsMax],
    ['team_size_min', state.teamSizeMin],
    ['team_size_max', state.teamSizeMax],
  ];
  for (const [field, value] of entries) {
    if (value === null || !overrideLimits(template, field)) {
      continue;
    }
    if (value !== templateDefault(template, field)) {
      out[field] = value;
    }
  }
  return out;
}

// ---- step validation -------------------------------------------------------------------------------------
export function validateBasics(state: WizardState): WizardIssue[] {
  const issues: WizardIssue[] = [];
  if (!state.sport) {
    issues.push({ key: 'mob.tw.err_sport', field: 'sport', step: WIZARD_STEP.basics });
  }
  if (!state.title.trim()) {
    issues.push({ key: 'mob.tw.err_title', field: 'title', step: WIZARD_STEP.basics });
  } else if (state.title.trim().length > TITLE_MAX) {
    issues.push({ key: 'mob.tw.err_title_long', params: { max: TITLE_MAX }, field: 'title', step: WIZARD_STEP.basics });
  }
  if (state.description.length > DESCRIPTION_MAX) {
    issues.push({ key: 'mob.tw.err_description_long', params: { max: DESCRIPTION_MAX }, field: 'description', step: WIZARD_STEP.basics });
  }
  return issues;
}

export function validateFormat(state: WizardState, templates: readonly WizardTemplate[]): WizardIssue[] {
  return findTemplate(templates, state.templateId)
    ? []
    : [{ key: 'mob.tw.err_format', field: 'template_id', step: WIZARD_STEP.format }];
}

export function validateParticipation(state: WizardState, template: WizardTemplate | null): WizardIssue[] {
  const issues: WizardIssue[] = [];
  const range = (field: WizardOverrideField, value: number | null): void => {
    const limit = overrideLimits(template, field);
    if (value === null) {
      issues.push({ key: 'mob.tw.err_count_required', field, step: WIZARD_STEP.participation });
    } else if (limit && (value < limit.min || value > limit.max)) {
      issues.push({ key: 'mob.tw.err_count_range', params: { min: limit.min, max: limit.max }, field, step: WIZARD_STEP.participation });
    }
  };
  range('entrants_min', state.entrantsMin);
  range('entrants_max', state.entrantsMax);
  if (state.entrantsMin !== null && state.entrantsMax !== null && state.entrantsMax < state.entrantsMin) {
    issues.push({
      key: state.participation === 'team' ? 'mob.tw.err_teams_order' : 'mob.tw.err_players_order',
      field: 'entrants_max',
      step: WIZARD_STEP.participation,
    });
  }
  if (state.participation === 'team') {
    range('team_size_min', state.teamSizeMin);
    range('team_size_max', state.teamSizeMax);
    if (state.teamSizeMin !== null && state.teamSizeMax !== null && state.teamSizeMax < state.teamSizeMin) {
      issues.push({ key: 'mob.tw.err_team_size_order', field: 'team_size_max', step: WIZARD_STEP.participation });
    }
  }
  return issues;
}

// ---- dates: the client mirror of the five server rules (AD-20 step 3) -------------------------------------
export type DateReason =
  | 'DATE_IN_PAST'
  | 'END_BEFORE_START'
  | 'DAILY_WINDOW_INVALID'
  | 'REG_CLOSE_AFTER_HARD'
  | 'HARD_BLOCK_TOO_CLOSE';

export type DateField = 'starts_at' | 'ends_at' | 'registration_closes_at' | 'registration_hard_block_at';

export interface DateFailure {
  field: DateField;
  reason: DateReason;
}

export function toDate(value: string): Date | null {
  return value ? localDateTimeToDate(value) : null;
}

/** Minutes after local midnight: the daily playing window is the local time of start and end (AD-20). */
function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * The five rules, first failure only, in the server's order (`create_contract.validate_dates`). Exactly at the gap
 * boundary passes. `null` for a field the organizer has not filled yet: required-ness is reported separately.
 */
export function firstDateFailure(
  dates: { startsAt: Date; endsAt: Date; closesAt: Date; hardBlockAt: Date },
  now: Date,
  minGapHours: number,
): DateFailure | null {
  const { startsAt, endsAt, closesAt, hardBlockAt } = dates;
  const checks: [DateField, Date][] = [
    ['registration_closes_at', closesAt],
    ['registration_hard_block_at', hardBlockAt],
    ['starts_at', startsAt],
    ['ends_at', endsAt],
  ];
  for (const [field, value] of checks) {
    if (value.getTime() <= now.getTime()) {
      return { field, reason: 'DATE_IN_PAST' };
    }
  }
  if (!(startsAt.getTime() < endsAt.getTime())) {
    return { field: 'ends_at', reason: 'END_BEFORE_START' };
  }
  if (!(minutesOfDay(startsAt) < minutesOfDay(endsAt))) {
    return { field: 'ends_at', reason: 'DAILY_WINDOW_INVALID' };
  }
  if (closesAt.getTime() > hardBlockAt.getTime()) {
    return { field: 'registration_closes_at', reason: 'REG_CLOSE_AFTER_HARD' };
  }
  if (hardBlockAt.getTime() + minGapHours * 3_600_000 > startsAt.getTime()) {
    return { field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' };
  }
  return null;
}

/** Board step a date failure is shown on: the window fields on "When and where", the registration ones on step 5. */
export function dateFailureStep(field: DateField | string | undefined): number {
  return field === 'starts_at' || field === 'ends_at' ? WIZARD_STEP.when : WIZARD_STEP.registration;
}

export function gapLabel(minGapHours: number): { key: LabelKey; params: Record<string, number> } {
  return minGapHours > 0 && minGapHours % 24 === 0
    ? { key: 'mob.tw.err_hard_gap_days', params: { gap: minGapHours / 24 } }
    : { key: 'mob.tw.err_hard_gap_hours', params: { gap: minGapHours } };
}

/**
 * The message for a date failure (server or client). `startLabel` is the formatted start ("Sat 14 Nov") for the
 * gap message. A hard block at or after the start reads "must be before the tournament starts" (TournRegErrStart);
 * otherwise the gap wording (TournRegErrGap) applies.
 */
export function dateFailureIssue(
  failure: DateFailure,
  ctx: { minGapHours: number; startLabel: string; hardBlockAtOrAfterStart: boolean },
): WizardIssue {
  const step = dateFailureStep(failure.field);
  const base = { field: failure.field, step };
  switch (failure.reason) {
    case 'DATE_IN_PAST':
      return failure.field === 'starts_at' || failure.field === 'ends_at'
        ? { ...base, key: 'mob.tw.err_window' }
        : { ...base, key: 'mob.tw.err_reg_past' };
    case 'END_BEFORE_START':
      return { ...base, key: 'mob.tw.err_window' };
    case 'DAILY_WINDOW_INVALID':
      return { ...base, key: 'mob.tw.err_daily_window' };
    case 'REG_CLOSE_AFTER_HARD':
      return { ...base, key: 'mob.tw.err_soft_after_hard' };
    case 'HARD_BLOCK_TOO_CLOSE':
    default: {
      if (ctx.hardBlockAtOrAfterStart) {
        return { ...base, key: 'mob.tw.err_hard_after_start' };
      }
      const gap = gapLabel(ctx.minGapHours);
      return { ...base, key: gap.key, params: { ...gap.params, start: ctx.startLabel } };
    }
  }
}

/** Hard block follows the closure until the organizer sets it (AD-20). */
export function withClosure(state: WizardState, closesAt: string): WizardState {
  return { ...state, closesAt, hardBlockAt: state.hardBlockTouched ? state.hardBlockAt : closesAt };
}

export function withHardBlock(state: WizardState, hardBlockAt: string): WizardState {
  return { ...state, hardBlockAt, hardBlockTouched: true };
}

function requiredIssue(field: DateField, step: number): WizardIssue {
  return { key: 'mob.tw.err_required', field, step };
}

/** Step 4: start and end present, in the future, ordered, one daily window. */
export function validateWindow(state: WizardState, now: Date): WizardIssue[] {
  const issues: WizardIssue[] = [];
  const startsAt = toDate(state.startsAt);
  const endsAt = toDate(state.endsAt);
  if (!startsAt) {
    issues.push(requiredIssue('starts_at', WIZARD_STEP.when));
  }
  if (!endsAt) {
    issues.push(requiredIssue('ends_at', WIZARD_STEP.when));
  }
  if (startsAt && endsAt) {
    if (startsAt.getTime() <= now.getTime()) {
      issues.push({ key: 'mob.tw.err_window', field: 'starts_at', step: WIZARD_STEP.when });
    } else if (!(startsAt.getTime() < endsAt.getTime())) {
      issues.push({ key: 'mob.tw.err_window', field: 'ends_at', step: WIZARD_STEP.when });
    } else if (!(minutesOfDay(startsAt) < minutesOfDay(endsAt))) {
      issues.push({ key: 'mob.tw.err_daily_window', field: 'ends_at', step: WIZARD_STEP.when });
    }
  }
  return issues;
}

export function hasVenue(state: WizardState, catalogueEnabled: boolean): boolean {
  return catalogueEnabled ? Boolean(state.venue && state.venue.name) : Boolean(state.venueName.trim());
}

export function validateVenue(state: WizardState, catalogueEnabled: boolean): WizardIssue[] {
  return hasVenue(state, catalogueEnabled) ? [] : [{ key: 'mob.tw.err_venue', field: 'venue', step: WIZARD_STEP.when }];
}

/** Step 5: closure and hard block present and consistent with the window (first failure, the server's order). */
export function validateRegistration(
  state: WizardState,
  now: Date,
  minGapHours: number,
  formatDay: (date: Date) => string,
): WizardIssue[] {
  const closes = toDate(state.closesAt);
  const hard = toDate(state.hardBlockAt);
  const issues: WizardIssue[] = [];
  if (!closes) {
    issues.push(requiredIssue('registration_closes_at', WIZARD_STEP.registration));
  }
  if (!hard) {
    issues.push(requiredIssue('registration_hard_block_at', WIZARD_STEP.registration));
  }
  const startsAt = toDate(state.startsAt);
  const endsAt = toDate(state.endsAt);
  if (closes && hard && startsAt && endsAt) {
    const failure = firstDateFailure({ startsAt, endsAt, closesAt: closes, hardBlockAt: hard }, now, minGapHours);
    // Window failures belong to step 4 and are caught there; only registration failures are shown here.
    if (failure && dateFailureStep(failure.field) === WIZARD_STEP.registration) {
      issues.push(
        dateFailureIssue(failure, {
          minGapHours,
          startLabel: formatDay(startsAt),
          hardBlockAtOrAfterStart: hard.getTime() >= startsAt.getTime(),
        }),
      );
    }
  }
  return issues;
}

// ---- visibility and committee ----------------------------------------------------------------------------
/** Board "Private" maps to the contract's `group` when groups are chosen and `invite` when none are. */
export function visibilityOf(state: WizardState): 'public' | 'group' | 'invite' {
  if (!state.isPrivate) {
    return 'public';
  }
  return state.groupIds.length > 0 ? 'group' : 'invite';
}

export function groupCapReached(state: WizardState, cap: number): boolean {
  return state.groupIds.length >= cap;
}

/** At least one additional member besides the organizer, at most `committee_max - 1` (AD-20 step 6). */
export function validateCommittee(state: WizardState, committeeMax: number): WizardIssue[] {
  if (state.committee.length < 1) {
    return [{ key: 'mob.tw.err_committee_few', field: 'committee_member_ids', step: WIZARD_STEP.committee }];
  }
  if (state.committee.length > committeeMax - 1) {
    return [
      { key: 'mob.tw.err_committee_many', params: { max: committeeMax }, field: 'committee_member_ids', step: WIZARD_STEP.committee },
    ];
  }
  return [];
}

export interface WizardContext {
  templates: readonly WizardTemplate[];
  limits: WizardLimits;
  catalogueEnabled: boolean;
  now: Date;
  formatDay: (date: Date) => string;
}

/** Issues for one board step. */
export function validateStep(step: number, state: WizardState, ctx: WizardContext): WizardIssue[] {
  const template = findTemplate(ctx.templates, state.templateId);
  switch (step) {
    case WIZARD_STEP.basics:
      return validateBasics(state);
    case WIZARD_STEP.format:
      return validateFormat(state, ctx.templates);
    case WIZARD_STEP.participation:
      return validateParticipation(state, template);
    case WIZARD_STEP.when:
      return [...validateWindow(state, ctx.now), ...validateVenue(state, ctx.catalogueEnabled)];
    case WIZARD_STEP.registration:
      return validateRegistration(state, ctx.now, ctx.limits.min_gap_hours, ctx.formatDay);
    case WIZARD_STEP.visibility:
      return [];
    case WIZARD_STEP.committee:
      return validateCommittee(state, ctx.limits.committee_max);
    default:
      return [];
  }
}

/** First board step (1 to 7) with an issue, or null when the whole wizard is valid. */
export function firstInvalidStep(state: WizardState, ctx: WizardContext): number | null {
  for (let step = WIZARD_STEP.basics; step < WIZARD_STEP.review; step += 1) {
    if (validateStep(step, state, ctx).length > 0) {
      return step;
    }
  }
  return null;
}

// ---- request body ----------------------------------------------------------------------------------------
function isoOf(value: string): string {
  const date = toDate(value);
  if (!date) {
    throw new Error('wizard date missing');
  }
  return date.toISOString();
}

/** The exact `POST /tournaments/v2/create` body. Throws only when called on an invalid state (a programming error). */
export function buildCreateBody(state: WizardState, template: WizardTemplate, catalogueEnabled: boolean): WizardCreateBody {
  const visibility = visibilityOf(state);
  const description = state.description.trim();
  const venue: Partial<WizardCreateBody> = {};
  if (catalogueEnabled && state.venue) {
    if (state.venue.othersInput) {
      venue.others = state.venue.othersInput;
    } else if (state.venue.venueId) {
      venue.venue_id = state.venue.venueId;
    }
  } else if (!catalogueEnabled) {
    venue.venue_name = state.venueName.trim();
    if (state.venueAddress.trim()) {
      venue.venue_address = state.venueAddress.trim();
    }
  }
  return {
    client_request_id: state.clientRequestId,
    template_id: template.id,
    overrides: buildOverrides(state, template),
    title: state.title.trim(),
    sport: state.sport,
    ...(description ? { description } : {}),
    participation_mode: state.participation,
    visibility,
    ...venue,
    starts_at: isoOf(state.startsAt),
    ends_at: isoOf(state.endsAt),
    registration_closes_at: isoOf(state.closesAt),
    registration_hard_block_at: isoOf(state.hardBlockAt),
    ...(visibility === 'group' ? { group_ids: [...state.groupIds] } : {}),
    committee_member_ids: state.committee.map(person => person.id),
  };
}

// ---- server rejections -----------------------------------------------------------------------------------
export type RejectionOutcome =
  | { kind: 'step'; step: number; issue: WizardIssue; dropGroupId?: string; dropUserId?: string }
  | { kind: 'format_retired'; step: number; issue: WizardIssue }
  | { kind: 'disabled'; issue: WizardIssue }
  | { kind: 'failed'; issue: WizardIssue };

interface ErrorLike {
  response?: { status?: number; data?: WizardRejection };
}

/** Server step (AD-20 numbering) to board step; a date rejection goes by field. */
export function boardStepFor(serverStep: number | undefined, field: string | undefined): number | null {
  switch (serverStep) {
    case 1:
      return WIZARD_STEP.when; // `create_contract.STEP_BASICS` carries the venue check
    case 2:
      return WIZARD_STEP.participation;
    case 3:
      return dateFailureStep(field);
    case 4:
      return WIZARD_STEP.visibility;
    case 5:
      return WIZARD_STEP.format;
    case 6:
      return WIZARD_STEP.committee;
    default:
      return null;
  }
}

const FAILED: WizardIssue = { key: 'mob.tw.err_create_failed', step: WIZARD_STEP.review };

/**
 * Turns a failed create into where to send the organizer and what to tell them. Anything the client cannot place
 * (network drop, 5xx, a body it does not recognise) is `failed`: the review step stays, state intact, and a retry
 * reuses the same `client_request_id`.
 */
export function mapCreateRejection(
  error: unknown,
  ctx: { minGapHours: number; committeeMax: number; startLabel: string; hardBlockAtOrAfterStart: boolean },
): RejectionOutcome {
  const response = (error as ErrorLike | null)?.response;
  const status = response?.status;
  const data = response?.data;
  if (typeof status !== 'number' || !data || typeof data !== 'object') {
    return { kind: 'failed', issue: FAILED };
  }
  const board = boardStepFor(data.step, data.field);
  switch (data.code) {
    case 'TOURNAMENT_DATES_INVALID': {
      const reason = data.reason as DateReason | undefined;
      const field = data.field as DateField | undefined;
      if (!reason || !field) {
        break;
      }
      const issue = dateFailureIssue({ field, reason }, ctx);
      return { kind: 'step', step: issue.step, issue };
    }
    case 'GROUP_CAP_EXCEEDED':
      return { kind: 'step', step: WIZARD_STEP.visibility, issue: { key: 'mob.tw.err_group_cap', field: 'group_ids', step: WIZARD_STEP.visibility } };
    case 'GROUP_NOT_MEMBER':
      return {
        kind: 'step',
        step: WIZARD_STEP.visibility,
        issue: { key: 'mob.tw.err_group_not_member', field: 'group_ids', step: WIZARD_STEP.visibility },
        dropGroupId: data.group_id,
      };
    case 'COMMITTEE_INVALID': {
      const keyByReason: Record<string, LabelKey> = {
        TOO_FEW: 'mob.tw.err_committee_few',
        TOO_MANY: 'mob.tw.err_committee_many',
        DUPLICATE: 'mob.tw.err_committee_duplicate',
        IS_ORGANIZER: 'mob.tw.err_committee_is_organizer',
        USER_UNAVAILABLE: 'mob.tw.err_committee_unavailable',
      };
      const key = keyByReason[data.reason ?? ''] ?? 'mob.tw.err_committee_few';
      const drop = data.reason === 'USER_UNAVAILABLE' || data.reason === 'IS_ORGANIZER' ? data.user_id : undefined;
      return {
        kind: 'step',
        step: WIZARD_STEP.committee,
        issue: { key, params: { max: ctx.committeeMax }, field: 'committee_member_ids', step: WIZARD_STEP.committee },
        dropUserId: drop,
      };
    }
    case 'TEMPLATE_NOT_FOUND':
    case 'TEMPLATE_NOT_ACTIVE':
      return { kind: 'format_retired', step: WIZARD_STEP.format, issue: { key: 'mob.tw.err_format_retired', field: 'template_id', step: WIZARD_STEP.format } };
    case 'OVERRIDES_INVALID':
      return { kind: 'step', step: WIZARD_STEP.participation, issue: { key: 'mob.tw.err_overrides', field: 'overrides', step: WIZARD_STEP.participation } };
    case 'VENUE_INVALID':
      return { kind: 'step', step: WIZARD_STEP.when, issue: { key: 'mob.tw.err_venue', field: 'venue', step: WIZARD_STEP.when } };
    default:
      break;
  }
  if (status === 409 && board === null && typeof data.detail === 'string' && /disabled/i.test(data.detail)) {
    return { kind: 'disabled', issue: { key: 'mob.tw.err_disabled', step: WIZARD_STEP.review } };
  }
  return { kind: 'failed', issue: FAILED };
}
