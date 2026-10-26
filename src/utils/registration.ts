/**
 * Tournament registration helpers (DES-MEETUP-ADDENDUM-tournament-registration AD-1, AD-3, AD-4, AD-5).
 *
 * - `classifyRegistrationError`: reads the stable `code` of a refusal from `POST /tournaments/{id}/registrations` and returns the label to
 *   show (`utils/refusal.ts`). The raw server `detail` is never shown. The generic label is for a system fault only.
 * - `feeLineFor`: the fee line of the confirmation sheet and the result pop-up ("Free registration" or "Registration fee: ... per ...").
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { TournamentParticipationMode } from '../types/tournament';
import { formatMoney, hasFee } from './money';
import { classifyRefusal } from './refusal';

type Translate = (key: LabelKey, params?: Record<string, string | number>) => string;

export interface RegistrationFailure {
  /** The server's `code`, upper case as sent, or null when the body had none. */
  code: string | null;
  labelKey: LabelKey;
  /** Placeholders of the label (`{range}` for TEAM_SIZE_INVALID). */
  labelParams?: Record<string, string | number>;
  /** `FEE_CHANGED` only: the current fee from the body (`registration_fee_cents`); null when the body did not carry a number. */
  currentFeeCents: number | null;
  /** True only for a system fault (generic label): a second attempt can work. The coded refusals are facts, not hiccups. */
  canRetry: boolean;
  /** `SKILL_LEVEL_REQUIRED` offers a link to the skill-level screen. */
  skillLevelLink: boolean;
  /** `NOT_TEAM_MEMBER` offers "Choose team" (board J6). */
  chooseTeamLink: boolean;
}

/** The refusal of `POST /tournaments/{id}/registrations`: one label per code (teams-payments AD-1), the generic text for a system fault only. */
export function classifyRegistrationError(error: unknown): RegistrationFailure {
  const refusal = classifyRefusal(error);
  return {
    code: refusal.code,
    labelKey: refusal.labelKey,
    ...(refusal.labelParams ? { labelParams: refusal.labelParams } : {}),
    currentFeeCents: refusal.code === 'FEE_CHANGED' ? refusal.currentFeeCents : null,
    canRetry: refusal.isSystemFault,
    skillLevelLink: refusal.code === 'SKILL_LEVEL_REQUIRED',
    chooseTeamLink: refusal.code === 'NOT_TEAM_MEMBER',
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
  chooseTeamLink: false,
};
