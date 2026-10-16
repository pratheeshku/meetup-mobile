/**
 * Reads a failed tournament-invitation call (invite-user/group/email, respond).
 * Shows the server's own text for 4xx; the body may be a FastAPI string
 * `detail`, a 422 array, or an object carrying `code` and a message. Nothing
 * here logs, and request payloads (emails) are never read.
 */
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
