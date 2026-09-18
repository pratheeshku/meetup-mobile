/**
 * Turns a failed API call into a user-facing message for inline form errors.
 *
 * Only 4xx responses are trusted to carry a message meant for the user:
 * FastAPI-style `detail` is either a string (e.g. 403/409) or, for 422, an
 * array of `{ loc, msg, type }` (the live `HTTPValidationError` schema).
 * Anything else — network failure, 5xx, unexpected shape — returns the
 * caller's generic `fallback` so internals are never shown. Nothing here logs.
 */
interface ValidationDetail {
  loc?: unknown[];
  msg?: unknown;
}

interface ErrorLike {
  response?: { status?: number; data?: { detail?: unknown } };
}

function fieldName(loc: unknown[] | undefined): string | null {
  const last = loc?.[loc.length - 1];
  return typeof last === 'string' ? last.replace(/_/g, ' ') : null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const response = (error as ErrorLike | null)?.response;
  const status = response?.status;
  if (typeof status !== 'number' || status < 400 || status >= 500) {
    return fallback;
  }

  const detail = response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = (detail as ValidationDetail[])
      .filter(item => typeof item?.msg === 'string' && item.msg)
      .map(item => {
        const field = fieldName(item.loc);
        return field ? `${field}: ${item.msg as string}` : (item.msg as string);
      });
    if (messages.length > 0) {
      return messages.join('\n');
    }
  }
  return status === 403 ? 'You do not have permission to do this.' : fallback;
}
