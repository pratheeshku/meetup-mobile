/**
 * Committee invitation answers (tl-c-accept): turns the coded server refusals into a state the screen can show without
 * a crash, and turns committee rows into names. The server decides every answer; this only reads it.
 *
 * The backend records a decline and an organizer's withdrawal the same way (`status = 'removed'`), so "already
 * declined" and "removed" arrive as one code, `committee_invitation_closed`, and are one state here.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { CommitteeMember } from '../types/tournament';

export type CommitteeAnswerState =
  | 'done'
  | 'already_active'
  | 'closed'
  | 'not_invited'
  | 'cancelled'
  | 'ended'
  | 'disabled'
  | 'failed';

export interface CommitteeAnswerOutcome {
  state: CommitteeAnswerState;
  /** Label key of the message to show for a refusal; null for success. */
  labelKey: LabelKey | null;
  /** Re-read the tournament: the answer changed what the server says about the caller. */
  refresh: boolean;
}

interface ErrorLike {
  response?: { status?: number; data?: { code?: unknown } };
}

const BY_CODE: Record<string, CommitteeAnswerOutcome> = {
  committee_already_active: { state: 'already_active', labelKey: 'mob.committee_invite.already_active', refresh: true },
  committee_invitation_closed: { state: 'closed', labelKey: 'mob.committee_invite.closed', refresh: true },
  committee_not_invited: { state: 'not_invited', labelKey: 'mob.committee_invite.not_invited', refresh: true },
  tournament_cancelled: { state: 'cancelled', labelKey: 'mob.committee_invite.cancelled', refresh: true },
  tournament_ended: { state: 'ended', labelKey: 'mob.committee_invite.ended', refresh: true },
  v2_disabled: { state: 'disabled', labelKey: 'mob.committee_invite.disabled', refresh: false },
};

export const COMMITTEE_ANSWER_DONE: CommitteeAnswerOutcome = { state: 'done', labelKey: null, refresh: true };

/** Unknown codes, network drops and 5xx are `failed`: nothing changed, the buttons stay and can be tried again. */
export function committeeAnswerOutcome(error: unknown): CommitteeAnswerOutcome {
  const code = (error as ErrorLike | null)?.response?.data?.code;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(BY_CODE, code)) {
    return BY_CODE[code];
  }
  return { state: 'failed', labelKey: 'mob.committee_invite.failed', refresh: false };
}

/**
 * Names of the people on a committee, organizer first, as the server ordered them. A missing `display_name` shows the
 * neutral label, never the id. `removed` rows are left out; `invited` rows are kept only when asked for.
 */
export function committeeNames(
  members: readonly CommitteeMember[],
  unknownName: string,
  options: { includeInvited?: boolean } = {},
): string[] {
  return members
    .filter(member => member.status === 'active' || (options.includeInvited === true && member.status === 'invited'))
    .map(member => (member.display_name && member.display_name.trim() ? member.display_name.trim() : unknownName));
}

/**
 * The card's "Dates" value, as the web card shows it: "14 Nov" for a one-day tournament, "14 – 15 Nov" inside one month,
 * "30 Nov – 2 Dec" across months. Device local time (the web card uses Asia/Singapore); empty when `startsAt` is missing
 * or not a date, so the row is left out rather than showing "Invalid Date".
 */
export function committeeDateRange(startsAt: string | null | undefined, endsAt: string | null | undefined): string {
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return '';
  }
  // Day first, as the web card writes it; only the month name follows the device's language.
  const dayMonth = (date: Date): string =>
    `${date.getDate()} ${date.toLocaleDateString(undefined, { month: 'short' })}`;
  const end = endsAt ? new Date(endsAt) : null;
  if (!end || Number.isNaN(end.getTime())) {
    return dayMonth(start);
  }
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return dayMonth(start);
  }
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  return sameMonth ? `${start.getDate()} – ${dayMonth(end)}` : `${dayMonth(start)} – ${dayMonth(end)}`;
}
