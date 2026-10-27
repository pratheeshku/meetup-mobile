/**
 * Reads a failed tournament-invitation call (invite-user/group/email, respond).
 * Shows the server's own text for 4xx; the body may be a FastAPI string
 * `detail`, a 422 array, or an object carrying `code` and a message. Nothing
 * here logs, and request payloads (emails) are never read.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import { classifyRefusal } from './refusal';

export interface TournamentInviteError {
  status: number | null;
  /** e.g. `INVITES_CLOSED`, when the server names one. */
  code: string | null;
  /** The server's text, or `null` when it sent none (caller uses its own fallback). */
  message: string | null;
}

interface ErrorLike {
  response?: { status?: number; data?: { detail?: unknown; code?: unknown; message?: unknown } };
}

const BARE_CODE = /^[A-Z][A-Z0-9_]+$/;

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readTournamentInviteError(error: unknown): TournamentInviteError {
  const response = (error as ErrorLike | null)?.response;
  const status = typeof response?.status === 'number' ? response.status : null;
  const data = response?.data;
  const detail = data?.detail;

  let code: string | null = null;
  let message: string | null = null;

  if (typeof detail === 'string') {
    const text = textOf(detail);
    if (text && BARE_CODE.test(text)) {
      code = text;
    } else {
      message = text;
      code = text?.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/)?.[0] ?? null;
    }
  } else if (Array.isArray(detail)) {
    message =
      detail
        .map(item => textOf((item as { msg?: unknown })?.msg))
        .filter((m): m is string => m !== null)
        .join('\n') || null;
  } else if (detail && typeof detail === 'object') {
    const obj = detail as { code?: unknown; message?: unknown; detail?: unknown; error?: unknown };
    code = textOf(obj.code) ?? textOf(obj.error);
    message = textOf(obj.message) ?? textOf(obj.detail);
  }

  code = code ?? textOf(data?.code);
  message = message ?? textOf(data?.message);

  // Only 4xx bodies are meant for the user; anything else uses the caller's fallback.
  if (status === null || status < 400 || status >= 500) {
    return { status, code: null, message: null };
  }
  return { status, code, message };
}

export function isInvitesClosed(error: TournamentInviteError): boolean {
  return error.status === 409 && error.code === 'INVITES_CLOSED';
}

const INVITE_TEXT_LABELS: Array<[RegExp, LabelKey]> = [
  [/^the organizer cannot be invited/i, 'mob.invite.err.organizer'],
  [/^user not found/i, 'mob.invite.err.user_not_found'],
  [/^user is already invited/i, 'mob.invite.err.already_invited'],
  [/e-mail address is already invited/i, 'mob.invite.err.email_already_invited'],
  [/^group not found/i, 'mob.invite.err.group_not_found'],
  [/^tournament not found/i, 'mob.reg.err.tournament_not_found'],
];

const INVITE_CODE_LABELS: Record<string, LabelKey> = {
  INVITES_CLOSED: 'mob.tournament.invites_closed',
  GROUP_CAP_REACHED: 'mob.invite.err.group_cap_reached',
  INVITE_LIMIT_REACHED: 'mob.invite.err.limit_reached',
  tournament_ended: 'mob.reg.err.tournament_ended',
};

/**
 * The label for a refused invite-user / invite-group / invite-email call (teams-payments AD-1: every refusal says why). The invite routes send a bare
 * code or a fixed sentence as `detail`, so the known ones are matched exactly; a 401/403/404/429 gets its status label, a 422 the e-mail label, and
 * the generic text is left for a fault. The server text itself is never shown. `featureOff` is the 404 "Not found" of a switched-off invitation flag.
 */
export function inviteRefusal(error: unknown): { labelKey: LabelKey; featureOff: boolean } {
  const info = readTournamentInviteError(error);
  const data = (error as ErrorLike | null)?.response?.data;
  const rawCode = typeof data?.code === 'string' ? data.code : info.code;
  if (info.status === 404 && info.message?.toLowerCase() === 'not found') {
    return { labelKey: 'mob.reg.err.not_found', featureOff: true };
  }
  if (rawCode && INVITE_CODE_LABELS[rawCode]) {
    return { labelKey: INVITE_CODE_LABELS[rawCode], featureOff: false };
  }
  const byText = info.message ? INVITE_TEXT_LABELS.find(([pattern]) => pattern.test(info.message as string)) : undefined;
  if (byText) {
    return { labelKey: byText[1], featureOff: false };
  }
  if (info.status === 422) {
    return { labelKey: 'mob.invite.err.invalid', featureOff: false };
  }
  return { labelKey: classifyRefusal(error, 'mob.add_remove.error').labelKey, featureOff: false };
}
