/**
 * Creation wizard logic (AD-20), kept free of React so it is testable on its own: step numbers, the per-step
 * validation, the client mirror of the five server date rules, the request body, and the mapping of a server
 * rejection to the wizard step and field the boards show. The server stays the only authority (AD-20): nothing is
 * adjusted silently and a server rejection always wins over what the client believed.
 *
 * Screens (tournament-experience AD-T3: the Format step is gone, there is one format): 1 Basics, 2 Participation,
 * 3 When and where, 4 Registration dates, 5 Who can see it, 6 Committee, 7 Review. The server numbers the wizard in
 * six steps (te-b1 report: Basics 1, Participation 2, Dates 3, Groups 4, Committee 5, Review 6 client only), where
 * "When and where" and "Registration dates" are both its Dates step. `step` in a rejection is translated here and
 * the count shown in the header follows the server mapping (`displayStep`).
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { PickedImage } from './imagePicker';
import type { OthersVenueInput } from '../types/venue';
import type {
  WizardCreateBody,
  WizardLimits,
  WizardParticipation,
  WizardRejection,
  WizardTemplate,
  WizardTemplatesResponse,
} from '../types/tournamentWizard';
import { localDateTimeToDate } from './localDateTime';

export const WIZARD_STEP = {
  basics: 1,
  participation: 2,
  when: 3,
  registration: 4,
  visibility: 5,
  committee: 6,
  review: 7,
} as const;
/** Number of screens. */
export const WIZARD_SCREEN_COUNT = 7;
/** Steps the server counts (te-b1 report): the count the header shows. */
export const WIZARD_TOTAL_STEPS = 6;

/** The server's step number for a screen: "When and where" and "Registration dates" are both its Dates step 3. */
export function displayStep(step: number): number {
  switch (step) {
    case WIZARD_STEP.basics:
      return 1;
    case WIZARD_STEP.participation:
      return 2;
    case WIZARD_STEP.when:
    case WIZARD_STEP.registration:
      return 3;
    case WIZARD_STEP.visibility:
      return 4;
    case WIZARD_STEP.committee:
      return 5;
    default:
      return 6;
  }
}

/** Server defaults when `limits` is absent (`create_contract.DEFAULT_*`). Read from the server whenever it sends them. */
export const FALLBACK_LIMITS: WizardLimits = { audience_group_cap: 20, committee_max: 10 };

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
  participation: WizardParticipation;
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
  /** Optional pictures, uploaded after the tournament is created (AD-T1). A failed upload never blocks creation. */
  banner: PickedImage | null;
  logo: PickedImage | null;
}

export function initialWizardState(clientRequestId: string, sport = ''): WizardState {
  return {
    clientRequestId,
    sport,
    title: '',
    description: '',
    participation: 'individual',
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
    banner: null,
    logo: null,
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
 * The five rules, first failure only, in the server's order (`create_contract.validate_dates`, AD-T4). There is no
 * minimum gap: a hard block exactly at the first game passes. `null` for a field the organizer has not filled yet:
 * required-ness is reported separately.
 */
export function firstDateFailure(
  dates: { startsAt: Date; endsAt: Date; closesAt: Date; hardBlockAt: Date },
  now: Date,
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
  if (hardBlockAt.getTime() > startsAt.getTime()) {
    return { field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' };
  }
  return null;
}

/** Screen a date failure is shown on: the window fields on "When and where", the registration ones on "Registration dates". */
export function dateFailureStep(field: DateField | string | undefined): number {
  return field === 'starts_at' || field === 'ends_at' ? WIZARD_STEP.when : WIZARD_STEP.registration;
}

/**
 * The message for a date failure (server or client). `startLabel` is the formatted first game ("Sat 14 Nov, 9:00 AM")
 * for the hard-block message. The code `HARD_BLOCK_TOO_CLOSE` is kept by the server; its meaning is now "the hard
 * block is after the start" (AD-T4).
 */
export function dateFailureIssue(failure: DateFailure, ctx: { startLabel: string }): WizardIssue {
  const step = dateFailureStep(failure.field);
  const base = { field: failure.field, step };
  switch (failure.reason) {
    case 'DATE_IN_PAST':
      return failure.field === 'starts_at' || failure.field === 'ends_at'
        ? { ...base, key: 'mob.tw.err_window' }
        : { ...base, key: 'mob.tw.dates_err_past' };
    case 'END_BEFORE_START':
      return { ...base, key: 'mob.tw.err_window' };
    case 'DAILY_WINDOW_INVALID':
      return { ...base, key: 'mob.tw.err_daily_window' };
    case 'REG_CLOSE_AFTER_HARD':
      return { ...base, key: 'mob.tw.dates_err_soft_after_hard' };
    case 'HARD_BLOCK_TOO_CLOSE':
    default:
      return { ...base, key: 'mob.tw.dates_err_hard_after_start', params: { when: ctx.startLabel } };
  }
}

/** One row of the rule checklist of the board TV2MobCreateDates: met, broken, or not decidable yet. */
export type RuleState = 'ok' | 'bad' | 'unknown';

/**
 * The three registration rules the board lists, for the dates entered so far. The first game is "start"; a missing
 * date leaves its rules `unknown` (never shown as met).
 */
export function registrationRules(
  state: WizardState,
  now: Date,
): { future: RuleState; order: RuleState; start: RuleState } {
  const closes = toDate(state.closesAt);
  const hard = toDate(state.hardBlockAt);
  const starts = toDate(state.startsAt);
  const dates = [closes, hard].filter((value): value is Date => value !== null);
  const future: RuleState =
    dates.length === 0 ? 'unknown' : dates.every(value => value.getTime() > now.getTime()) ? 'ok' : 'bad';
  const order: RuleState = closes && hard ? (closes.getTime() <= hard.getTime() ? 'ok' : 'bad') : 'unknown';
  const start: RuleState = hard && starts ? (hard.getTime() <= starts.getTime() ? 'ok' : 'bad') : 'unknown';
  return { future, order, start };
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

/** Registration dates: closure and hard block present and consistent with the window (first failure, the server's order). */
export function validateRegistration(
  state: WizardState,
  now: Date,
  formatDayTime: (date: Date) => string,
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
    const failure = firstDateFailure({ startsAt, endsAt, closesAt: closes, hardBlockAt: hard }, now);
    // Window failures belong to "When and where" and are caught there; only registration failures are shown here.
    if (failure && dateFailureStep(failure.field) === WIZARD_STEP.registration) {
      issues.push(dateFailureIssue(failure, { startLabel: formatDayTime(startsAt) }));
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
  limits: WizardLimits;
  catalogueEnabled: boolean;
  now: Date;
  formatDayTime: (date: Date) => string;
}

/** Issues for one screen. */
export function validateStep(step: number, state: WizardState, ctx: WizardContext): WizardIssue[] {
  switch (step) {
    case WIZARD_STEP.basics:
      return validateBasics(state);
    case WIZARD_STEP.when:
      return [...validateWindow(state, ctx.now), ...validateVenue(state, ctx.catalogueEnabled)];
    case WIZARD_STEP.registration:
      return validateRegistration(state, ctx.now, ctx.formatDayTime);
    case WIZARD_STEP.committee:
      return validateCommittee(state, ctx.limits.committee_max);
    default:
      return [];
  }
}

/** First screen (1 to 6) with an issue, or null when the whole wizard is valid. */
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

/**
 * The exact `POST /tournaments/v2/create` body. `template_id` and `overrides` are never sent (AD-T3): the server uses
 * the single default format. Throws only when called on an invalid state (a programming error). */
export function buildCreateBody(state: WizardState, catalogueEnabled: boolean): WizardCreateBody {
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
  | { kind: 'disabled'; issue: WizardIssue }
  | { kind: 'failed'; issue: WizardIssue };

interface ErrorLike {
  response?: { status?: number; data?: WizardRejection };
}

/** Server step (te-b1 six-step numbering) to screen; a date rejection goes by field. */
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
  ctx: { committeeMax: number; startLabel: string },
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
    case 'OVERRIDES_INVALID':
      // The client sends neither (AD-T3), so these mean the server's default format is not active: nothing the
      // organizer can change. Shown on Review, state kept.
      return { kind: 'failed', issue: { key: 'mob.tw.err_template_unavailable', step: WIZARD_STEP.review } };
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
