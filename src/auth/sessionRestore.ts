/**
 * How a failed startup/resume session check is treated.
 *
 * Only a definitive auth rejection signs the user out. Transport failures,
 * timeouts, 5xx, 429, and a refresh that failed the same way are retried
 * with bounded backoff, then left on the splash retry state. Tokens and the
 * refresh cookie stay put.
 */
import {
  isNetworkError,
  isRateLimitError,
  isServerError,
} from '../utils/networkError';

export type SessionCheckFailure = 'network' | 'server' | 'rate_limit';

/** Includes the first try. */
export const SESSION_RESTORE_MAX_ATTEMPTS = 3;

/** Wait before attempt 2, then before attempt 3. */
export const SESSION_RESTORE_BACKOFF_MS = [500, 1500] as const;

/**
 * The interceptor keeps the session when a refresh fails for a transient
 * reason and rejects with the original 401. The refresh error is stashed
 * here so startup can classify the real failure (network / 5xx / 429)
 * rather than the leftover 401.
 */
export function restoreFailureOf(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'refreshFailure' in error
  ) {
    const failure = (error as { refreshFailure?: unknown }).refreshFailure;
    if (failure !== undefined) {
      return failure;
    }
  }
  return error;
}

/** Network, timeout, HTTP 5xx, or HTTP 429. Anything else is not auto-retried. */
export function isTransientRestoreFailure(error: unknown): boolean {
  return (
    isNetworkError(error) || isRateLimitError(error) || isServerError(error)
  );
}

/** Label-facing bucket for the splash retry state. Unknown failures use the generic server copy. */
export function sessionCheckFailureKind(error: unknown): SessionCheckFailure {
  if (isRateLimitError(error)) {
    return 'rate_limit';
  }
  if (isNetworkError(error)) {
    return 'network';
  }
  return 'server';
}
