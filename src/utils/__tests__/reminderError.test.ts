/** Invite reminder (v1.0.2): the failed-POST reader and the row patch. */
import type { ResponsesResponse } from '../../types/event';
import { applyReminderAck, parseReminderError } from '../reminderError';

const http = (status: number, data?: unknown) => ({ response: { status, data } });

describe('parseReminderError', () => {
  it('404 hides the control', () => {
    expect(parseReminderError(http(404, { detail: 'Not found' }))).toEqual({ kind: 'hidden' });
  });

  it.each([
    ['REMINDER_NO_ACCOUNT', 'no_account'],
    ['REMINDER_LIMIT', 'limit'],
    ['game_ended', 'item_closed'],
    ['tournament_closed', 'item_closed'],
    ['TOURNAMENT_ENDED', 'item_closed'],
  ])('409 %s is blocked: %s', (code, reason) => {
    expect(parseReminderError(http(409, { code }))).toEqual({ kind: 'blocked', reason });
  });

  it('409 REMINDER_NOT_PENDING asks for a refresh', () => {
    expect(parseReminderError(http(409, { code: 'REMINDER_NOT_PENDING' }))).toEqual({ kind: 'not_pending' });
  });

  it('409 REMINDER_TOO_SOON carries retry_after_seconds', () => {
    expect(parseReminderError(http(409, { code: 'REMINDER_TOO_SOON', retry_after_seconds: 240 }))).toEqual({
      kind: 'blocked',
      reason: 'too_soon',
      retryAfterSeconds: 240,
    });
  });

  it('reads the code and the seconds from under `detail` too', () => {
    expect(
      parseReminderError(http(409, { detail: { code: 'REMINDER_TOO_SOON', retry_after_seconds: 90 } })),
    ).toEqual({ kind: 'blocked', reason: 'too_soon', retryAfterSeconds: 90 });
    expect(parseReminderError(http(409, { detail: { code: 'REMINDER_LIMIT' } }))).toEqual({
      kind: 'blocked',
      reason: 'limit',
    });
  });

  it('TOO_SOON without usable seconds still blocks', () => {
    expect(parseReminderError(http(409, { code: 'REMINDER_TOO_SOON' }))).toEqual({
      kind: 'blocked',
      reason: 'too_soon',
      retryAfterSeconds: undefined,
    });
  });

  it.each([
    ['network failure', new Error('Network Error')],
    ['500', http(500)],
    ['403', http(403, { detail: 'Not allowed' })],
    ['unknown 409 code', http(409, { code: 'SOMETHING_ELSE' })],
    ['409 without a code', http(409, { detail: 'conflict' })],
    ['null', null],
  ])('%s is a failed send (retry)', (_name, error) => {
    expect(parseReminderError(error)).toEqual({ kind: 'failed' });
  });
});

describe('applyReminderAck', () => {
  const responses: ResponsesResponse = {
    accepted: { total: 0, items: [] },
    pending: {
      total: 2,
      items: [
        { user_id: 'u1', display_name: 'Ann', can_remind: true, reminder_count: 0, last_reminded_at: null },
        { user_id: 'u2', display_name: 'Bo', can_remind: true, reminder_count: 1, last_reminded_at: '2026-11-19T00:00:00Z' },
      ],
    },
  };
  const ack = { sent_at: '2026-11-20T05:00:00Z', last_reminded_at: '2026-11-20T05:00:00Z', reminder_count: 2 };

  it('updates only that row and leaves can_remind as the server sent it', () => {
    const next = applyReminderAck(responses, 'u2', ack) as ResponsesResponse;
    expect(next.pending?.items[1]).toMatchObject({ last_reminded_at: ack.last_reminded_at, reminder_count: 2, can_remind: true });
    expect(next.pending?.items[0]).toBe(responses.pending?.items[0]);
    expect(next.pending?.total).toBe(2);
    expect(responses.pending?.items[1].reminder_count).toBe(1);
  });

  it('is a no-op without a Pending section or responses', () => {
    const noPending = { accepted: { total: 0, items: [] } } as ResponsesResponse;
    expect(applyReminderAck(noPending, 'u1', ack)).toBe(noPending);
    expect(applyReminderAck(null, 'u1', ack)).toBeNull();
  });
});
