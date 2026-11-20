/**
 * Reads a failed reminder POST (DES-MEETUP-ADDENDUM-invite-reminder v1.0.2) into one outcome the Responses
 * row can show. Pure; nothing here logs.
 *
 * - 404: no access, user not invited, or the feature is off -> hide the control.
 * - 409 `REMINDER_NOT_PENDING`: already replied -> refresh the list.
 * - 409 `REMINDER_NO_ACCOUNT`, `REMINDER_LIMIT`, `REMINDER_TOO_SOON` (`retry_after_seconds`) -> disabled with the reason.
 * - 409 `game_ended` (games) or the tournament equivalent -> item closed. The contract does not name the
 *   tournament code, so any other 409 code that says "ended" or "closed" is read the same way.
 * - anything else (network failure, 5xx, 403, unknown 409) -> failed, retry.
 *
 * The code may sit at the top of the body or under `detail` (FastAPI), so both are read.
 */
import type { ReminderAck, ResponsesResponse } from '../types/event';

export type ReminderOutcome =
  | { kind: 'hidden' }
  | { kind: 'not_pending' }
  | { kind: 'blocked'; reason: 'no_account' | 'limit' | 'too_soon' | 'item_closed'; retryAfterSeconds?: number }
  | { kind: 'failed' };

interface ErrorBody {
  code?: unknown;
  retry_after_seconds?: unknown;
  detail?: unknown;
}

function field(body: ErrorBody | undefined, key: 'code' | 'retry_after_seconds'): unknown {
  if (body && body[key] !== undefined) {
    return body[key];
  }
  const detail = body?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return (detail as ErrorBody)[key];
  }
  return undefined;
}

export function parseReminderError(error: unknown): ReminderOutcome {
  const response = (error as { response?: { status?: number; data?: ErrorBody } } | null)?.response;
  const status = response?.status;
  if (status === 404) {
    return { kind: 'hidden' };
  }
  if (status !== 409) {
    return { kind: 'failed' };
  }

  const rawCode = field(response?.data, 'code');
  const code = typeof rawCode === 'string' ? rawCode : '';
  switch (code) {
    case 'REMINDER_NOT_PENDING':
      return { kind: 'not_pending' };
    case 'REMINDER_NO_ACCOUNT':
      return { kind: 'blocked', reason: 'no_account' };
    case 'REMINDER_LIMIT':
      return { kind: 'blocked', reason: 'limit' };
    case 'REMINDER_TOO_SOON': {
      const seconds = field(response?.data, 'retry_after_seconds');
      return {
        kind: 'blocked',
        reason: 'too_soon',
        retryAfterSeconds: typeof seconds === 'number' && seconds > 0 ? seconds : undefined,
      };
    }
    default:
      return /ended|closed/i.test(code) ? { kind: 'blocked', reason: 'item_closed' } : { kind: 'failed' };
  }
}

/**
 * Copies a 200 from `POST .../reminders` onto that person's Pending row (`last_reminded_at`, `reminder_count`),
 * leaving everything else, including the server's `can_remind`, as it was until the next load. Pure.
 */
export function applyReminderAck(
  responses: ResponsesResponse | null,
  userId: string,
  ack: ReminderAck,
): ResponsesResponse | null {
  if (!responses?.pending) {
    return responses;
  }
  return {
    ...responses,
    pending: {
      ...responses.pending,
      items: responses.pending.items.map(person =>
        person.user_id === userId
          ? { ...person, last_reminded_at: ack.last_reminded_at, reminder_count: ack.reminder_count }
          : person,
      ),
    },
  };
}
