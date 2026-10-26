/**
 * One label for every refusal (DES-MEETUP-ADDENDUM-teams-payments AD-1). The server answers a refused action with `{detail, code}`; the app
 * shows the label of the `code` (`mob.reg.err.<code>`) and NEVER the `detail` text.
 *
 * - A coded refusal shows its own label (the registration codes, the team, payment, fee and points codes).
 * - No usable code: 401 and 403 show "You cannot do this", 404 "Not found", 429 the rate-limit label (its body is `{error: ...}`, no code).
 * - The generic label is for a system fault only: `INTERNAL_ERROR`, any 5xx, no response at all (network) and an unreadable body. An unknown
 *   code on a 4xx also falls to it, because a text the app has no label for is never shown.
 */
import type { LabelKey } from '../labels/fallbackLabels';

/** Server code -> label key. The keys of the migration M1 seed (`mob.reg.err.*`) plus the pre-existing registration codes. */
const CODE_LABELS = {
  REGISTRATION_CLOSED: 'mob.reg.err.registration_closed',
  SKILL_LEVEL_REQUIRED: 'mob.reg.err.skill_level_required',
  ALREADY_REGISTERED: 'mob.reg.err.already_registered',
  TOURNAMENT_FULL: 'mob.reg.err.tournament_full',
  INVITATION_REQUIRED: 'mob.reg.err.invitation_required',
  TEAM_REQUIRED: 'mob.reg.err.team_required',
  FEE_CHANGED: 'mob.reg.err.fee_changed',
  FEE_ACK_REQUIRED: 'mob.reg.err.fee_ack_required',
  NOT_TEAM_MEMBER: 'mob.reg.err.not_team_member',
  TEAM_NOT_FOUND: 'mob.reg.err.team_not_found',
  TEAM_SIZE_INVALID: 'mob.reg.err.team_size_invalid',
  TEAM_NAME_TAKEN: 'mob.reg.err.team_name_taken',
  SPORT_MISMATCH: 'mob.reg.err.sport_mismatch',
  USER_MISMATCH: 'mob.reg.err.user_mismatch',
  USER_REQUIRED: 'mob.reg.err.user_required',
  REGISTRATION_DATES_NOT_SET: 'mob.reg.err.registration_dates_not_set',
  TOURNAMENT_NOT_FOUND: 'mob.reg.err.tournament_not_found',
  TOURNAMENT_NOT_ACTIVE: 'mob.reg.err.tournament_not_active',
  COMMITTEE_ADD_CLOSED: 'mob.reg.err.committee_add_closed',
  COMMITTEE_ONLY: 'mob.reg.err.committee_only',
  INDIVIDUAL_ONLY: 'mob.reg.err.individual_only',
  LIFECYCLE_V2_ONLY: 'mob.reg.err.lifecycle_v2_only',
  WITHDRAWAL_CLOSED: 'mob.reg.err.withdrawal_closed',
  WITHDRAWAL_AFTER_SCHEDULE: 'mob.reg.err.withdrawal_after_schedule',
  WITHDRAWAL_AFTER_CLOSE: 'mob.reg.err.withdrawal_after_close',
  ROSTER_FROZEN: 'mob.reg.err.roster_frozen',
  NOT_A_TEAM_REGISTRATION: 'mob.reg.err.not_a_team_registration',
  ROSTER_MEMBER_INVALID: 'mob.reg.err.roster_member_invalid',
  REGISTRATION_NOT_FOUND: 'mob.reg.err.registration_not_found',
  NOT_AUTHORIZED: 'mob.reg.err.not_authorized',
  NO_FEE: 'mob.reg.err.no_fee',
  FEE_INVALID: 'mob.reg.err.fee_invalid',
  PAYMENT_NUMBER_REQUIRED: 'mob.reg.err.payment_number_required',
  PAYMENT_NUMBER_INVALID: 'mob.reg.err.payment_number_invalid',
  PAYMENT_NUMBER_CLOSED: 'mob.reg.err.payment_number_closed',
  PAYMENT_CLOSED: 'mob.reg.err.payment_closed',
  PAYMENT_EXEMPT: 'mob.reg.err.payment_exempt',
  POINTS_LOCKED: 'mob.reg.err.points_locked',
  POINTS_NEGATIVE: 'mob.reg.err.points_negative',
  POINTS_NOT_NUMERIC: 'mob.reg.err.points_not_numeric',
  POINTS_OUT_OF_BOUNDS: 'mob.reg.err.points_out_of_bounds',
  // The lower-case code of tournaments.lifecycle keeps the message the screens already showed before this task.
  tournament_ended: 'mob.closure.game_ended',
  game_ended: 'mob.closure.game_ended',
} as const satisfies Record<string, LabelKey>;

type KnownCode = keyof typeof CODE_LABELS;

const GENERIC: LabelKey = 'mob.reg.err.generic';
const FORBIDDEN: LabelKey = 'mob.reg.err.forbidden';
const NOT_FOUND: LabelKey = 'mob.reg.err.not_found';
const RATE_LIMITED: LabelKey = 'mob.reg.err.rate_limited';

export interface Refusal {
  /** The server's `code` (upper case, except the two closure codes); null when the body had none. */
  code: string | null;
  status: number | null;
  labelKey: LabelKey;
  /** Placeholders of the label: `{range}` for TEAM_SIZE_INVALID. */
  labelParams?: Record<string, string | number>;
  /** `FEE_CHANGED` / `FEE_ACK_REQUIRED`: the current fee in whole cents from the body; null when it did not carry a number. */
  currentFeeCents: number | null;
  /** True for the system-fault case (generic label): a second attempt can work. A coded refusal is a fact, not a hiccup. */
  isSystemFault: boolean;
}

interface ErrorLike {
  response?: {
    status?: number;
    data?: { code?: unknown; registration_fee_cents?: unknown; min?: unknown; max?: unknown };
  };
}

function isKnown(code: string): code is KnownCode {
  return Object.prototype.hasOwnProperty.call(CODE_LABELS, code);
}

function sizeRange(min: unknown, max: unknown): string | null {
  const lo = typeof min === 'number' && Number.isFinite(min) ? min : null;
  const hi = typeof max === 'number' && Number.isFinite(max) ? max : null;
  if (lo === null && hi === null) {
    return null;
  }
  if (lo !== null && hi !== null) {
    return lo === hi ? String(lo) : `${lo} to ${hi}`;
  }
  return String(lo ?? hi);
}

/**
 * The label to show for a failed call. `generic` is the label for a system fault (default: the registration one, "Could not register.
 * Please try again."; a screen that is not a registration passes `mob.reg.err.internal_error`).
 */
export function classifyRefusal(error: unknown, generic: LabelKey = GENERIC): Refusal {
  const response = (error as ErrorLike | null)?.response;
  const status = typeof response?.status === 'number' ? response.status : null;
  const data = response?.data;
  const rawCode = typeof data?.code === 'string' ? data.code : null;
  const code = rawCode !== null && !isKnown(rawCode) ? rawCode.toUpperCase() : rawCode;
  const fee = data?.registration_fee_cents;
  const currentFeeCents =
    (code === 'FEE_CHANGED' || code === 'FEE_ACK_REQUIRED') && typeof fee === 'number' && Number.isFinite(fee) ? fee : null;
  const base = { code, status, currentFeeCents };

  if (code !== null && isKnown(code)) {
    const range = code === 'TEAM_SIZE_INVALID' ? sizeRange(data?.min, data?.max) : null;
    return {
      ...base,
      labelKey: CODE_LABELS[code],
      ...(code === 'TEAM_SIZE_INVALID' ? { labelParams: { range: range ?? '' } } : {}),
      isSystemFault: false,
    };
  }
  if (status === 429) {
    return { ...base, labelKey: RATE_LIMITED, isSystemFault: false };
  }
  if (status === 401 || status === 403) {
    return { ...base, labelKey: FORBIDDEN, isSystemFault: false };
  }
  if (status === 404) {
    return { ...base, labelKey: NOT_FOUND, isSystemFault: false };
  }
  return { ...base, labelKey: generic, isSystemFault: true };
}

/** The label text of a refusal, for screens that show one line. */
export function refusalText(
  error: unknown,
  t: (key: LabelKey, params?: Record<string, string | number>) => string,
  generic: LabelKey = 'mob.reg.err.internal_error',
): string {
  const refusal = classifyRefusal(error, generic);
  return t(refusal.labelKey, refusal.labelParams);
}
