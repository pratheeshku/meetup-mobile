/**
 * Tournament registration helpers (DES-MEETUP-ADDENDUM-tournament-registration AD-1, AD-3, AD-4, AD-5).
 *
 * - `classifyRegistrationError`: reads the stable `code` of a refusal from `POST /tournaments/{id}/registrations` and returns the label to
 *   show. The raw server `detail` is never shown. An unknown code, or no code at all, is `mob.reg.err.generic`.
 * - `feeLineFor`: the fee line of the confirmation sheet and the result pop-up ("Free registration" or "Registration fee: ... per ...").
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { TournamentParticipationMode } from '../types/tournament';
import { formatMoney, hasFee } from './money';

type Translate = (key: LabelKey, params?: Record<string, string | number>) => string;

const CODE_LABELS: Record<string, LabelKey> = {
  REGISTRATION_CLOSED: 'mob.reg.err.registration_closed',
  SKILL_LEVEL_REQUIRED: 'mob.reg.err.skill_level_required',
  ALREADY_REGISTERED: 'mob.reg.err.already_registered',
  TOURNAMENT_FULL: 'mob.reg.err.tournament_full',
  INVITATION_REQUIRED: 'mob.reg.err.invitation_required',
  TEAM_REQUIRED: 'mob.reg.err.team_required',
  FEE_CHANGED: 'mob.reg.err.fee_changed',
  FEE_ACK_REQUIRED: 'mob.reg.err.fee_ack_required',
};

/** Closure codes the screen already handled before this task; they keep their own message. */
const ENDED_CODES = new Set(['game_ended', 'tournament_ended']);

export interface RegistrationFailure {
  /** The server's `code`, upper case as sent, or null when the body had none. */
  code: string | null;
  labelKey: LabelKey;
  /** `FEE_CHANGED` only: the current fee from the body (`registration_fee_cents`); null when the body did not carry a number. */
  currentFeeCents: number | null;
  /** True where a second attempt can work (the unknown or generic case). The coded refusals are facts, not hiccups. */
  canRetry: boolean;
  /** `SKILL_LEVEL_REQUIRED` offers a link to the skill-level screen. */
  skillLevelLink: boolean;
}

interface ErrorLike {
  response?: { status?: number; data?: { code?: unknown; detail?: unknown; registration_fee_cents?: unknown } };
}

export function classifyRegistrationError(error: unknown): RegistrationFailure {
  const data = (error as ErrorLike | null)?.response?.data;
  const rawCode = typeof data?.code === 'string' ? data.code : null;
  const code = rawCode && !ENDED_CODES.has(rawCode) ? rawCode.toUpperCase() : rawCode;
  const known = code ? CODE_LABELS[code] : undefined;
  const ended = rawCode !== null && ENDED_CODES.has(rawCode);
  const fee = data?.registration_fee_cents;
  return {
    code,
    labelKey: ended ? 'mob.closure.game_ended' : known ?? 'mob.reg.err.generic',
    currentFeeCents: code === 'FEE_CHANGED' && typeof fee === 'number' && Number.isFinite(fee) ? fee : null,
    canRetry: !known && !ended,
    skillLevelLink: code === 'SKILL_LEVEL_REQUIRED',
  };
}

/** The fee line: "Free registration", or the per-player or per-team text with the amount formatted from cents and currency. */
export function feeLineFor(
  t: Translate,
  feeCents: number | null | undefined,
  currency: string | null | undefined,
  mode: TournamentParticipationMode | null | undefined,
): string {
  if (!hasFee(feeCents) || !currency) {
    return t('mob.reg.free');
  }
  const amount = formatMoney(feeCents, currency);
  return mode === 'team' ? t('mob.reg.fee_per_team', { amount }) : t('mob.reg.fee_per_player', { amount });
}

/** The caller's teams for one tournament: same sport (case-insensitive), in the server's order. */
export function teamsForSport<T extends { sport: string }>(teams: readonly T[], sport: string): T[] {
  const wanted = sport.trim().toLowerCase();
  return teams.filter(team => team.sport.trim().toLowerCase() === wanted);
}

/** Shown in the result pop-up when a team tournament is opened by someone with no team for its sport (no request is made). */
export const TEAM_EMPTY_FAILURE: RegistrationFailure = {
  code: 'TEAM_EMPTY',
  labelKey: 'mob.reg.team_empty',
  currentFeeCents: null,
  canRetry: false,
  skillLevelLink: false,
};
