/**
 * Correlation ID generation and propagation (DES-MEETUP-MOBILE.md §3.12, R-113, P4).
 *
 * A correlation ID is a UUIDv4 generated client-side **per logical user
 * action**, not per raw HTTP call — a multi-call sequence (e.g. a
 * challenge -> verify -> submit flow) must share one ID. `withCorrelationId`
 * generates a single ID and threads it explicitly through every call made
 * inside `fn`, by attaching it to each request's config rather than relying
 * on ambient/global mutable state (which would risk leaking across
 * concurrent logical actions in a single-threaded-but-async JS runtime).
 *
 * A single ad hoc call made outside of `withCorrelationId` still gets its
 * own fresh, valid correlation ID from the request interceptor's fallback
 * (see `client.ts`), so R-113 traceability holds for every request either way.
 */
import uuid from 'react-native-uuid';

export function generateCorrelationId(): string {
  return uuid.v4() as string;
}

/**
 * Runs `fn` with a single correlation ID, passed as the first argument.
 * Callers thread this ID into each request they make during `fn` via the
 * `correlationId` field on that request's config (see `ApiRequestConfig`).
 */
export async function withCorrelationId<T>(
  fn: (correlationId: string) => Promise<T>,
): Promise<T> {
  const correlationId = generateCorrelationId();
  return fn(correlationId);
}
