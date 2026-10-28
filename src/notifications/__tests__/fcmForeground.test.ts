/**
 * Foreground handler (`onMessage` in `fcm.ts`).
 *
 * `event_participant_added` / `event_participant_removed` are delivered
 * data-only and rendered as a local notify-kit notification with View/OK
 * actions (`participantHandler.ts`); they return early and never reach the
 * in-app banner. `group_event_created` (Join+OK) / `event_changed`
 * (View+OK) are the same kind of exception, added by the mobile notify-kit
 * task Part 3 (`eventNotificationHandler.ts`) — `event_changed` previously
 * fell through to the banner (see the "every other known type" test below,
 * now using `event_invite` instead). Every other known type keeps its
 * existing banner behaviour, and an unknown type is still dropped.
 *
 * (These participant cases previously asserted the banner; that behaviour was
 * deliberately replaced by the notify-kit action-button task, Step 4:
 * "return early — do not fall through to showBanner".)
 */
import notifee from 'react-native-notify-kit';
import * as firebaseMessaging from '@react-native-firebase/messaging';

import { onMessage } from '../fcm';
import { PLAN_CHANNEL_ID } from '../channels';
import { dismissBanner, getBannerState } from '../notificationBannerStore';
import { getUnreadBadgeCount, setUnreadBadgeCount } from '../unreadCountStore';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../hooks/useUnreadCount', () => ({ refreshUnreadCount: jest.fn() }));

import { refreshUnreadCount } from '../../hooks/useUnreadCount';
const mockRefreshUnreadCount = refreshUnreadCount as jest.Mock;
const mockOnMessage = firebaseMessaging.onMessage as jest.Mock;
const mockDisplayNotification = notifee.displayNotification as jest.Mock;

type Handler = (message: unknown) => void;
let deliver: Handler;

beforeEach(() => {
  mockDisplayNotification.mockClear();
  setUnreadBadgeCount(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockOnMessage.mockImplementation((_messaging: unknown, cb: Handler) => {
    deliver = cb;
    return () => {};
  });
  onMessage();
});

afterEach(() => {
  dismissBanner();
  jest.restoreAllMocks();
});

describe.each([
  ['event_participant_added', 'You were added', 'Sunday football'],
  ['event_participant_removed', 'You were removed', 'Sunday football'],
  ['group_event_created', 'New event in your group', 'Sunday football, 6pm, Central Park'],
  ['event_changed', 'Event updated', 'Venue changed: Central Park -> Riverside Courts'],
  ['event_reminder', 'Event reminder', 'Match starts in 1 hour'],
])('%s', (type, title, body) => {
  it('displays a local notification with the payload title, body and data — not the banner', () => {
    deliver({
      messageId: 'm1',
      data: { notification_type: type, entity_id: 'evt-7', title, body },
    });

    expect(mockDisplayNotification).toHaveBeenCalledTimes(1);
    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title,
        body,
        data: { notification_type: type, entity_id: 'evt-7', title, body },
        android: expect.objectContaining({ channelId: PLAN_CHANNEL_ID }),
      }),
    );
    expect(getBannerState()).toBeNull();
  });

  it('takes title/body from data, not from an FCM notification block', () => {
    deliver({
      messageId: 'm2',
      data: { notification_type: type, entity_id: 'evt-7', title, body },
      notification: { title: 'ignored title', body: 'ignored body' },
    });

    expect(mockDisplayNotification).toHaveBeenCalledWith(expect.objectContaining({ title, body }));
    expect(getBannerState()).toBeNull();
  });

  it('handles a missing entity_id safely: still displays, and does not throw', () => {
    expect(() =>
      deliver({ messageId: 'm3', data: { notification_type: type, title, body } }),
    ).not.toThrow();

    expect(mockDisplayNotification).toHaveBeenCalledTimes(1);
    expect(mockDisplayNotification.mock.calls[0][0].data).toEqual({
      notification_type: type,
      title,
      body,
    });
    expect(getBannerState()).toBeNull();
  });

  it('drops a non-string entity_id from the data passed to the notification', () => {
    deliver({ messageId: 'm4', data: { notification_type: type, entity_id: 123, title, body } });

    expect(mockDisplayNotification.mock.calls[0][0].data).not.toHaveProperty('entity_id');
    expect(getBannerState()).toBeNull();
  });
});

it('still shows the banner (and never notify-kit) for every other known type — unchanged behaviour', () => {
  deliver({
    messageId: 'm6',
    // A push with a `notification` block (flag off / old path) keeps the banner;
    // the data-only shape is the push-actions path (pushActionsDisplay.test.ts).
    notification: { title: 't', body: 'b' },
    data: { notification_type: 'event_invite', entity_id: 'evt-9', title: 't', body: 'b' },
  });

  expect(getBannerState()).toEqual({
    notification_type: 'event_invite',
    entity_id: 'evt-9',
    title: 't',
    body: 'b',
  });
  expect(mockDisplayNotification).not.toHaveBeenCalled();
});

it.each(['tournament_updated', 'tournament_registration_added'])('%s is no longer dropped: the foreground banner shows it (er-m-series)', type => {
  deliver({ messageId: 'm8', notification: { title: 't', body: 'b' }, data: { notification_type: type, entity_id: 't-9', title: 't', body: 'b' } });

  expect(getBannerState()).toEqual({ notification_type: type, entity_id: 't-9', title: 't', body: 'b' });
});

it('does not throw or surface an unhandled rejection when the local display fails', async () => {
  mockDisplayNotification.mockRejectedValueOnce(new Error('notification permission denied'));

  expect(() =>
    deliver({
      messageId: 'm7',
      data: { notification_type: 'event_participant_added', entity_id: 'evt-1', title: 't', body: 'b' },
    }),
  ).not.toThrow();
  // Let the rejected promise's .catch run; an unhandled rejection would fail the run.
  await Promise.resolve();
  await Promise.resolve();

  expect(getBannerState()).toBeNull();
});

it('still drops a type the app does not know (unchanged behaviour)', () => {
  deliver({
    messageId: 'm5',
    data: { notification_type: 'event_something_new', entity_id: 'evt-1', title: 't', body: 'b' },
  });

  expect(getBannerState()).toBeNull();
  expect(mockDisplayNotification).not.toHaveBeenCalled();
});

describe('unread badge count', () => {
  // The count comes from the server (`refreshUnreadCount`), never from local arithmetic.
  beforeEach(() => {
    mockRefreshUnreadCount.mockClear();
    setUnreadBadgeCount(0);
  });

  it.each([
    ['a banner-type message', 'event_invite'],
    ['a participant (data-only) message', 'event_participant_added'],
    ['a group_event_created/event_changed (data-only) message', 'event_changed'],
  ])('reads the count back from the server for %s and does not increment locally', (_name, type) => {
    deliver({
      messageId: 'm1',
      data: { notification_type: type, entity_id: 'e1', title: 't', body: 'b' },
    });
    expect(mockRefreshUnreadCount).toHaveBeenCalledTimes(1);
    expect(getUnreadBadgeCount()).toBe(0);
  });

  it('does nothing for a message with no notification_type', () => {
    deliver({ messageId: 'm3', data: { something: 'else' } });
    expect(mockRefreshUnreadCount).not.toHaveBeenCalled();
    expect(getUnreadBadgeCount()).toBe(0);
  });
});
