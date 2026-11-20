/** Organizer Remind control on Pending rows (DES-MEETUP-ADDENDUM-invite-reminder v1.0.2). */
import React from 'react';
import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import ResponsesSection from '../ResponsesSection';
import type { ReminderApi } from '../ResponsesSection';
import type { ResponsePerson, ResponsesResponse } from '../../../types/event';

const NOW = '2026-11-20T05:00:00.000Z';
const ago = (minutes: number): string => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();

function responsesWith(pending: ResponsePerson[]): ResponsesResponse {
  return {
    accepted: { total: 1, items: [{ user_id: 'org', display_name: 'Olive' }] },
    pending: { total: pending.length, items: pending },
    declined: { total: 0, items: [] },
  };
}

const http = (status: number, data?: unknown) => ({ response: { status, data } });
const button = (root: Instance, index: number): Instance | undefined =>
  root.findAll(n => n.props.testID === `remind-button-${index}` && typeof n.props.onPress === 'function')[0];
/** The rendered button's accessibility state (Button sets `disabled` and `busy` on its host node). */
const buttonState = (root: Instance, index: number): { disabled?: boolean; busy?: boolean } | undefined =>
  root.findAll(n => n.props.testID === `remind-button-${index}` && typeof n.type === 'string')[0]?.props
    .accessibilityState;
const status = (root: Instance, index: number): string | undefined => {
  const node = root.findAll(n => n.props.testID === `remind-status-${index}` && typeof n.type === 'string')[0];
  return node ? texts(node).join(' ') : undefined;
};
const tap = async (root: Instance, index: number): Promise<void> => {
  await act(async () => {
    button(root, index)?.props.onPress();
  });
};
function makeRemind(send: ReminderApi['send']): ReminderApi & { refresh: jest.Mock } {
  return { send, refresh: jest.fn() };
}
const ack = { sent_at: NOW, last_reminded_at: NOW, reminder_count: 1 };

describe('Remind control on Pending rows', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Remind only where the server said can_remind', () => {
    const remind = makeRemind(jest.fn());
    const root = render(
      <ResponsesSection
        responses={responsesWith([
          { user_id: 'p1', display_name: 'Ann', can_remind: true },
          { user_id: 'p2', display_name: 'Bo', can_remind: false, remind_blocked_reason: null },
          { user_id: 'p3', display_name: 'Cy' },
        ])}
        remind={remind}
      />,
    );
    expect(button(root, 0)).toBeDefined();
    expect(buttonState(root, 0)).toMatchObject({ busy: false, disabled: false });
    expect(button(root, 1)).toBeUndefined();
    expect(button(root, 2)).toBeUndefined();
    expect(texts(root)).toContain('Remind');
    expect(texts(root).join(' ')).not.toContain('Reminders are switched off');
  });

  it('shows nothing without the remind prop, and on other sections', () => {
    const root = render(
      <ResponsesSection responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])} />,
    );
    expect(button(root, 0)).toBeUndefined();
    expect(root.findAll(n => String(n.props.testID ?? '').startsWith('remind-button-'))).toHaveLength(0);
  });

  it.each([
    ['no_account', 'This person has no account yet'],
    ['limit', 'Reminder limit reached'],
    ['item_closed', 'This invitation is closed'],
  ])('a blocked row (%s) is disabled with the reason', (reason, text) => {
    const root = render(
      <ResponsesSection
        responses={responsesWith([
          { user_id: 'p1', display_name: 'Ann', can_remind: false, remind_blocked_reason: reason },
        ])}
        remind={makeRemind(jest.fn())}
      />,
    );
    expect(button(root, 0)).toBeDefined();
    expect(status(root, 0)).toBe(text);
    expect(buttonState(root, 0)?.disabled).toBe(true);
  });

  it('too_soon uses the server seconds, in whole minutes rounded up', () => {
    const root = render(
      <ResponsesSection
        responses={responsesWith([
          {
            user_id: 'p1',
            display_name: 'Ann',
            can_remind: false,
            remind_blocked_reason: 'too_soon',
            remind_retry_after_seconds: 241,
          },
        ])}
        remind={makeRemind(jest.fn())}
      />,
    );
    expect(status(root, 0)).toBe('Try again in 5 minutes');
  });

  it('shows "Reminded <when>" under the name when last_reminded_at is set', () => {
    const root = render(
      <ResponsesSection
        responses={responsesWith([
          { user_id: 'p1', display_name: 'Ann', can_remind: true, last_reminded_at: ago(5) },
          { user_id: 'p2', display_name: 'Bo', can_remind: true, last_reminded_at: null },
        ])}
        remind={makeRemind(jest.fn())}
      />,
    );
    const reminded = root.findAll(n => String(n.props.testID ?? '').startsWith('reminded-') && typeof n.type === 'string');
    expect(reminded).toHaveLength(1);
    expect(texts(reminded[0]).join('')).toBe('Reminded 5m ago');
  });

  it('tap sends for that user, then shows "Reminder sent"', async () => {
    let resolveSend: (value: typeof ack) => void = () => undefined;
    const send = jest.fn(() => new Promise<typeof ack>(resolve => { resolveSend = resolve; }));
    const root = render(
      <ResponsesSection
        responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])}
        remind={makeRemind(send)}
      />,
    );
    await tap(root, 0);
    expect(send).toHaveBeenCalledWith('p1');
    // Sending state: the button is busy and not pressable.
    expect(buttonState(root, 0)).toMatchObject({ busy: true, disabled: true });
    await act(async () => resolveSend(ack));
    expect(status(root, 0)).toBe('Reminder sent');
    // Sent: the button stays but is disabled until the next load.
    expect(buttonState(root, 0)).toMatchObject({ busy: false, disabled: true });
  });

  it('REMINDER_NOT_PENDING refreshes the list and says the person already replied', async () => {
    const remind = makeRemind(jest.fn().mockRejectedValue(http(409, { code: 'REMINDER_NOT_PENDING' })));
    const root = render(
      <ResponsesSection responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])} remind={remind} />,
    );
    await tap(root, 0);
    expect(remind.refresh).toHaveBeenCalledTimes(1);
    expect(status(root, 0)).toBe('This person has already replied');
    expect(button(root, 0)).toBeUndefined();
  });

  it('REMINDER_LIMIT disables the row with the limit text', async () => {
    const remind = makeRemind(jest.fn().mockRejectedValue(http(409, { code: 'REMINDER_LIMIT' })));
    const root = render(
      <ResponsesSection responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])} remind={remind} />,
    );
    await tap(root, 0);
    expect(status(root, 0)).toBe('Reminder limit reached');
    expect(buttonState(root, 0)?.disabled).toBe(true);
  });

  it('REMINDER_TOO_SOON uses retry_after_seconds', async () => {
    const remind = makeRemind(
      jest.fn().mockRejectedValue(http(409, { code: 'REMINDER_TOO_SOON', retry_after_seconds: 130 })),
    );
    const root = render(
      <ResponsesSection responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])} remind={remind} />,
    );
    await tap(root, 0);
    expect(status(root, 0)).toBe('Try again in 3 minutes');
  });

  it('a 404 hides that control', async () => {
    const remind = makeRemind(jest.fn().mockRejectedValue(http(404, { detail: 'Not found' })));
    const root = render(
      <ResponsesSection responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])} remind={remind} />,
    );
    await tap(root, 0);
    expect(button(root, 0)).toBeUndefined();
    expect(status(root, 0)).toBeUndefined();
  });

  it('a network failure says "Could not send reminder" and the button retries', async () => {
    const send = jest.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(ack);
    const root = render(
      <ResponsesSection responses={responsesWith([{ user_id: 'p1', display_name: 'Ann', can_remind: true }])} remind={makeRemind(send)} />,
    );
    await tap(root, 0);
    expect(status(root, 0)).toBe('Could not send reminder');
    await tap(root, 0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(status(root, 0)).toBe('Reminder sent');
  });

  it('a person without a user id (email-only) gets no control', () => {
    const root = render(
      <ResponsesSection
        responses={responsesWith([{ user_id: null, display_name: '', email: 'x@example.com', can_remind: true }])}
        remind={makeRemind(jest.fn())}
      />,
    );
    expect(button(root, 0)).toBeUndefined();
  });
});
