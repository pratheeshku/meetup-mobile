import axios from 'axios';

export const RATE_LIMIT_MESSAGE = 'Too many attempts. Try again in a minute.';
export const SERVER_ERROR_MESSAGE = 'Something went wrong. Try again.';
export const NETWORK_ERROR_MESSAGE = 'Unable to connect to server.';

/**
 * Checks whether an error indicates the server was unreachable (network down,
 * DNS failure, connection refused, or request timeout).
 *
 * If `error.response` exists with a status code, the server was reached.
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.status === 'number') {
      return false;
    }
    return (
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('network'))
    );
  }
  if (error instanceof Error) {
    if ((error as { response?: { status?: number } })?.response?.status) {
      return false;
    }
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('timeout') || msg.includes('unreachable');
  }
  return false;
}

/** Returns the HTTP status code from an error, if present. */
export function getHttpStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }
  return (error as { response?: { status?: number } })?.response?.status;
}

/** Checks whether the error is HTTP 429 Too Many Requests. */
export function isRateLimitError(error: unknown): boolean {
  return getHttpStatus(error) === 429;
}

/** Checks whether the error is a 5xx server error (500-599). */
export function isServerError(error: unknown): boolean {
  const status = getHttpStatus(error);
  return typeof status === 'number' && status >= 500 && status < 600;
}
