/**
 * `group_event_created` / `event_changed` notifications
 * (`eventNotificationHandler.ts`): local notify-kit notification with
 * Join/OK actions (group_event_created) or View/OK actions (event_changed)
 * — same shape, differing only in the primary action's label/id — and the
 * press handling behind it.
 *
 * Mirrors `participantHandler.test.ts`'s structure/coverage.
 */
import notifee, { AndroidStyle, EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { PLAN_CHANNEL_ID } from './channels';
import { navigationRef } from './notificationRouting';
import {
  displayEventNotification,
  getInitialEventNotification,
  handleEventNotificationEvent,
  isEventNotificationType,
  registerEventBackgroundHandler,
  registerEventForegroundHandler,
} from './eventNotificationHandler';

const mockDisplayNotification = notifee.displayNotification as jest.Mock;
const mockCancelNotification = notifee.cancelNotification as jest.Mock;
const mockGetInitialNotification = notifee.getInitialNotification as jest.Mock;
const mockOnBackgroundEvent = notifee.onBackgroundEvent as jest.Mock;
const mockOnForegroundEvent = notifee.onForegroundEvent as jest.Mock;

const isReadySpy = jest.spyOn(navigationRef, 'isReady');
const navigateSpy = jest.spyOn(navigationRef, 'navigate') as unknown as jest.Mock;

const GROUP_EVENT_DATA = {
  notification_type: 'group_event_created',
  entity_id: 'evt-42',
  title: 'New event in your group',
  body: 'Sunday football\n6pm, Central Park',
};

const EVENT_CHANGED_DATA = {
  notification_type: 'event_changed',
  entity_id: 'evt-42',
  title: 'Event updated',
  body: 'Venue changed: Central Park -> Riverside Courts',
};

function makeEvent(
  type: EventType,
  pressActionId: string | undefined,
  data: Record<string, unknown> = GROUP_EVENT_DATA,
): Event {
  return {
    type,
    detail: {
      notification: { id: 'notif-1', data },
      ...(pressActionId ? { pressAction: { id: pressActionId } } : {}),
    },
  } as Event;
}

beforeEach(() => {
  jest.clearAllMocks();
  isReadySpy.mockReturnValue(true);
  navigateSpy.mockImplementation(() => undefined);
});

afterAll(() => {
  isReadySpy.mockRestore();
  navigateSpy.mockRestore();
});

describe('displayEventNotification', () => {
  it('calls notifee.displayNotification with channelId PLAN_CHANNEL_ID and Join + OK actions for group_event_created', async () => {
    await displayEventNotification(GROUP_EVENT_DATA);

    expect(mockDisplayNotification).toHaveBeenCalledTimes(1);
    const notification = mockDisplayNotification.mock.calls[0][0];
    expect(notification.title).toBe(GROUP_EVENT_DATA.title);
    expect(notification.body).toBe(GROUP_EVENT_DATA.body);
    expect(notification.android.channelId).toBe(PLAN_CHANNEL_ID);
    expect(notification.android.pressAction).toEqual({ id: 'default' });
    expect(notification.android.actions).toHaveLength(2);
    expect(notification.android.actions.map((a: { title: string }) => a.title)).toEqual([
      'Join',
      'OK',
    ]);
    expect(
      notification.android.actions.map((a: { pressAction: { id: string } }) => a.pressAction.id),
    ).toEqual(['join', 'ok']);
    const [join, ok] = notification.android.actions;
    expect(join.pressAction.launchActivity).toBe('default');
    expect(ok.pressAction).not.toHaveProperty('launchActivity');
  });

  it('calls notifee.displayNotification with two actions (View, OK) for event_changed — same shape as participantHandler', async () => {
    await displayEventNotification(EVENT_CHANGED_DATA);

    const notification = mockDisplayNotification.mock.calls[0][0];
    expect(notification.android.actions).toHaveLength(2);
    expect(notification.android.actions.map((a: { title: string }) => a.title)).toEqual([
      'View',
      'OK',
    ]);
    expect(
      notification.android.actions.map((a: { pressAction: { id: string } }) => a.pressAction.id),
    ).toEqual(['view', 'ok']);
    const [view, ok] = notification.android.actions;
    expect(view.pressAction.launchActivity).toBe('default');
    expect(ok.pressAction).not.toHaveProperty('launchActivity');
  });

  it('attaches the payload as notification data so the press handlers can read entity_id', async () => {
    await displayEventNotification(GROUP_EVENT_DATA);

    expect(mockDisplayNotification.mock.calls[0][0].data).toEqual(GROUP_EVENT_DATA);
  });

  it('uses BigText style with the full body so a multi-line body is shown when expanded', async () => {
    await displayEventNotification(GROUP_EVENT_DATA);

    expect(mockDisplayNotification.mock.calls[0][0].android.style).toEqual({
      type: AndroidStyle.BIGTEXT,
      text: GROUP_EVENT_DATA.body,
    });
  });

  it.each([
    ['empty', { ...GROUP_EVENT_DATA, body: '' }],
    ['missing', { notification_type: 'group_event_created', entity_id: 'evt-42', title: 't' }],
  ])(
    'omits the style (rather than passing empty text, which notify-kit rejects) when body is %s',
    async (_label, data) => {
      await displayEventNotification(data);

      expect(mockDisplayNotification).toHaveBeenCalledTimes(1);
      expect(mockDisplayNotification.mock.calls[0][0].android).not.toHaveProperty('style');
      expect(mockDisplayNotification.mock.calls[0][0].android.channelId).toBe(PLAN_CHANNEL_ID);
    },
  );
});

describe('registerEventBackgroundHandler', () => {
  function registerAndGetHandler(): (event: Event) => Promise<void> {
    registerEventBackgroundHandler();
    expect(mockOnBackgroundEvent).toHaveBeenCalledTimes(1);
    return mockOnBackgroundEvent.mock.calls[0][0];
  }

  it('navigates to EventDetailScreen (entity_id as eventId) on a Join press — NOT an RSVP API call', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'join'));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('also clears the tray entry on a Join press: navigates first, then cancels by notification id', async () => {
    const handler = registerAndGetHandler();
    const order: string[] = [];
    navigateSpy.mockImplementation(() => {
      order.push('navigate');
    });
    mockCancelNotification.mockImplementationOnce(async () => {
      order.push('cancel');
    });

    await handler(makeEvent(EventType.ACTION_PRESS, 'join'));

    expect(mockCancelNotification).toHaveBeenCalledTimes(1);
    expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
    expect(order).toEqual(['navigate', 'cancel']);
  });

  it('navigates on a body tap (PRESS) too, so tapping the group_event_created notification still opens the event', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.PRESS, 'default'));

    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
    // Body tap is left to the notification's own auto-cancel; only Join/View
    // cancel explicitly.
    expect(mockCancelNotification).not.toHaveBeenCalled();
  });

  it('cancels the notification on an OK press (group_event_created) and makes no navigation (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'ok', GROUP_EVENT_DATA));

    expect(mockCancelNotification).toHaveBeenCalledTimes(1);
    expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('navigates to EventDetailScreen on a View press for event_changed', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'view', EVENT_CHANGED_DATA));

    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('cancels the notification on an OK press (event_changed) and makes no navigation (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'ok', EVENT_CHANGED_DATA));

    expect(mockCancelNotification).toHaveBeenCalledTimes(1);
    expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('cancels the notification on DISMISSED and makes no navigation (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.DISMISSED, undefined));

    expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown action id (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'something-else'));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(mockCancelNotification).not.toHaveBeenCalled();
  });

  it('does not navigate when the notification is not one of these two types (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(
      makeEvent(EventType.ACTION_PRESS, 'join', {
        notification_type: 'group_invite',
        entity_id: 'grp-1',
      }),
    );

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not navigate (and does not throw) when the notification carries no data (negative)', async () => {
    const handler = registerAndGetHandler();

    await expect(
      handler({ type: EventType.ACTION_PRESS, detail: { pressAction: { id: 'join' } } } as Event),
    ).resolves.toBeUndefined();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('drops the navigation silently when the navigation container is not ready (headless/quit state)', async () => {
    isReadySpy.mockReturnValue(false);
    const handler = registerAndGetHandler();

    await expect(handler(makeEvent(EventType.ACTION_PRESS, 'join'))).resolves.toBeUndefined();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('registerEventForegroundHandler', () => {
  it('registers the same handler for foreground events and returns the unsubscribe', () => {
    const unsubscribe = jest.fn();
    mockOnForegroundEvent.mockReturnValueOnce(unsubscribe);

    const result = registerEventForegroundHandler();

    expect(mockOnForegroundEvent).toHaveBeenCalledWith(handleEventNotificationEvent);
    expect(result).toBe(unsubscribe);
  });
});

describe('getInitialEventNotification (quit-state launch)', () => {
  it('returns the payload when the app was launched by pressing Join', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', title: 'New event in your group', body: 'b', data: GROUP_EVENT_DATA },
      pressAction: { id: 'join' },
    });

    await expect(getInitialEventNotification()).resolves.toEqual({
      notification_type: 'group_event_created',
      entity_id: 'evt-42',
      title: 'New event in your group',
      body: 'b',
    });
  });

  it('returns the payload when the app was launched by pressing View (event_changed)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', title: 'Event updated', body: 'b', data: EVENT_CHANGED_DATA },
      pressAction: { id: 'view' },
    });

    await expect(getInitialEventNotification()).resolves.toEqual({
      notification_type: 'event_changed',
      entity_id: 'evt-42',
      title: 'Event updated',
      body: 'b',
    });
  });

  it('returns the payload when the app was launched by a body tap', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: GROUP_EVENT_DATA },
      pressAction: { id: 'default' },
    });

    await expect(getInitialEventNotification()).resolves.toMatchObject({
      notification_type: 'group_event_created',
      entity_id: 'evt-42',
    });
  });

  it('returns null on a normal launch (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce(null);

    await expect(getInitialEventNotification()).resolves.toBeNull();
  });

  it('returns null when the initial press was the OK button (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: EVENT_CHANGED_DATA },
      pressAction: { id: 'ok' },
    });

    await expect(getInitialEventNotification()).resolves.toBeNull();
  });

  it('returns null when the initial press was the OK button on group_event_created (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: GROUP_EVENT_DATA },
      pressAction: { id: 'ok' },
    });

    await expect(getInitialEventNotification()).resolves.toBeNull();
  });

  it('returns null for a notification not handled by this file (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: { notification_type: 'group_invite', entity_id: 'g' } },
      pressAction: { id: 'default' },
    });

    await expect(getInitialEventNotification()).resolves.toBeNull();
  });
});

describe('isEventNotificationType', () => {
  it.each(['group_event_created', 'event_changed'])('accepts %s', type => {
    expect(isEventNotificationType(type)).toBe(true);
  });

  it.each(['event_invite', 'event_participant_added', 'global', '', undefined, null, 7, {}])(
    'rejects %p',
    value => {
      expect(isEventNotificationType(value)).toBe(false);
    },
  );
});
