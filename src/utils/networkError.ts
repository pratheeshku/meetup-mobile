import axios from 'axios';

/**
 * Checks whether an error indicates the server was unreachable (network down,
 * DNS failure, connection refused, or request timeout).
 *
 * If `error.response` exists, the server was reached (even on 4xx/5xx responses).
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return (
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('network'))
    );
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('timeout') || msg.includes('unreachable');
  }
  return false;
}
