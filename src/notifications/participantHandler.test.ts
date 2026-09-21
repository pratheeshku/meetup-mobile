/**
 * Participant notifications (`participantHandler.ts`): local notify-kit
 * notification with View/OK actions, and the press handling behind it.
 *
 * Tests 1 and 2 are the two required by the task brief (Step 7). The rest pin
 * library behaviour that the brief's literal handler got wrong (verified
 * against react-native-notify-kit 10.7.1 source): action buttons emit
 * `EventType.ACTION_PRESS` — not `PRESS` — and View needs an explicit
 * `launchActivity` to open the app.
 */
import notifee, { EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { PLAN_CHANNEL_ID } from './channels';
import { navigationRef } from './notificationRouting';
import {
  displayParticipantNotification,
  getInitialParticipantNotification,
  handleParticipantNotificationEvent,
  isParticipantNotificationType,
  registerParticipantBackgroundHandler,
  registerParticipantForegroundHandler,
} from './participantHandler';

const mockDisplayNotification = notifee.displayNotification as jest.Mock;
const mockCancelNotification = notifee.cancelNotification as jest.Mock;
const mockGetInitialNotification = notifee.getInitialNotification as jest.Mock;
const mockOnBackgroundEvent = notifee.onBackgroundEvent as jest.Mock;
const mockOnForegroundEvent = notifee.onForegroundEvent as jest.Mock;

const isReadySpy = jest.spyOn(navigationRef, 'isReady');
const navigateSpy = jest.spyOn(navigationRef, 'navigate') as unknown as jest.Mock;

const PARTICIPANT_DATA = {
  notification_type: 'event_participant_added',
  entity_id: 'evt-42',
  title: 'You were added',
  body: 'Sunday football\nSaturday 6pm',
};

function makeEvent(
  type: EventType,
  pressActionId: string | undefined,
  data: Record<string, unknown> = PARTICIPANT_DATA,
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

describe('displayParticipantNotification', () => {
  // Required test 1.
  it('calls notifee.displayNotification with channelId PLAN_CHANNEL_ID and two actions (View, OK)', async () => {
    await displayParticipantNotification(PARTICIPANT_DATA);

    expect(mockDisplayNotification).toHaveBeenCalledTimes(1);
    const notification = mockDisplayNotification.mock.calls[0][0];
    expect(notification.title).toBe(PARTICIPANT_DATA.title);
    expect(notification.body).toBe(PARTICIPANT_DATA.body);
    expect(notification.android.channelId).toBe(PLAN_CHANNEL_ID);
    expect(notification.android.pressAction).toEqual({ id: 'default' });
    expect(notification.android.actions).toHaveLength(2);
    expect(notification.android.actions.map((a: { title: string }) => a.title)).toEqual([
      'View',
      'OK',
    ]);
    expect(notification.android.actions.map((a: { pressAction: { id: string } }) => a.pressAction.id)).toEqual([
      'view',
      'ok',
    ]);
  });

  it('attaches the payload as notification data so the press handlers can read entity_id', async () => {
    await displayParticipantNotification(PARTICIPANT_DATA);

    expect(mockDisplayNotification.mock.calls[0][0].data).toEqual(PARTICIPANT_DATA);
  });

  it('makes View launch the app (launchActivity) but OK not — OK must never open the app', async () => {
    await displayParticipantNotification(PARTICIPANT_DATA);

    const [view, ok] = mockDisplayNotification.mock.calls[0][0].android.actions;
    expect(view.pressAction.launchActivity).toBe('default');
    expect(ok.pressAction).not.toHaveProperty('launchActivity');
  });
});

describe('registerParticipantBackgroundHandler', () => {
  function registerAndGetHandler(): (event: Event) => Promise<void> {
    registerParticipantBackgroundHandler();
    expect(mockOnBackgroundEvent).toHaveBeenCalledTimes(1);
    return mockOnBackgroundEvent.mock.calls[0][0];
  }

  // Required test 2.
  it('navigates to EventDetailScreen (entity_id as eventId) on a View press', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'view'));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
    expect(mockCancelNotification).not.toHaveBeenCalled();
  });

  it('routes the same way for event_participant_removed', async () => {
    const handler = registerAndGetHandler();

    await handler(
      makeEvent(EventType.ACTION_PRESS, 'view', {
        ...PARTICIPANT_DATA,
        notification_type: 'event_participant_removed',
      }),
    );

    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('navigates on a body tap (PRESS) too, so tapping the notification still opens the event', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.PRESS, 'default'));

    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('cancels the notification on an OK press and makes no navigation (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(makeEvent(EventType.ACTION_PRESS, 'ok'));

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

  it('does not navigate when the notification is not a participant type (negative)', async () => {
    const handler = registerAndGetHandler();

    await handler(
      makeEvent(EventType.ACTION_PRESS, 'view', {
        notification_type: 'group_invite',
        entity_id: 'grp-1',
      }),
    );

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not navigate (and does not throw) when the notification carries no data (negative)', async () => {
    const handler = registerAndGetHandler();

    await expect(
      handler({ type: EventType.ACTION_PRESS, detail: { pressAction: { id: 'view' } } } as Event),
    ).resolves.toBeUndefined();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('falls back to the events list rather than opening EventDetail with an empty id', async () => {
    const handler = registerAndGetHandler();

    await handler(
      makeEvent(EventType.ACTION_PRESS, 'view', {
        notification_type: 'event_participant_added',
        title: 't',
        body: 'b',
      }),
    );

    expect(navigateSpy).toHaveBeenCalledWith('Home', { screen: 'EventsList' });
  });

  it('drops the navigation silently when the navigation container is not ready (headless/quit state)', async () => {
    isReadySpy.mockReturnValue(false);
    const handler = registerAndGetHandler();

    await expect(handler(makeEvent(EventType.ACTION_PRESS, 'view'))).resolves.toBeUndefined();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('registerParticipantForegroundHandler', () => {
  it('registers the same handler for foreground events and returns the unsubscribe', () => {
    const unsubscribe = jest.fn();
    mockOnForegroundEvent.mockReturnValueOnce(unsubscribe);

    const result = registerParticipantForegroundHandler();

    expect(mockOnForegroundEvent).toHaveBeenCalledWith(handleParticipantNotificationEvent);
    expect(result).toBe(unsubscribe);
  });
});

describe('getInitialParticipantNotification (quit-state launch)', () => {
  it('returns the payload when the app was launched by pressing View', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', title: 'You were added', body: 'b', data: PARTICIPANT_DATA },
      pressAction: { id: 'view' },
    });

    await expect(getInitialParticipantNotification()).resolves.toEqual({
      notification_type: 'event_participant_added',
      entity_id: 'evt-42',
      title: 'You were added',
      body: 'b',
    });
  });

  it('returns the payload when the app was launched by a body tap', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: PARTICIPANT_DATA },
      pressAction: { id: 'default' },
    });

    await expect(getInitialParticipantNotification()).resolves.toMatchObject({
      notification_type: 'event_participant_added',
      entity_id: 'evt-42',
    });
  });

  it('returns null on a normal launch (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce(null);

    await expect(getInitialParticipantNotification()).resolves.toBeNull();
  });

  it('returns null when the initial press was the OK button (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: PARTICIPANT_DATA },
      pressAction: { id: 'ok' },
    });

    await expect(getInitialParticipantNotification()).resolves.toBeNull();
  });

  it('returns null for a non-participant notification (negative)', async () => {
    mockGetInitialNotification.mockResolvedValueOnce({
      notification: { id: 'n', data: { notification_type: 'group_invite', entity_id: 'g' } },
      pressAction: { id: 'default' },
    });

    await expect(getInitialParticipantNotification()).resolves.toBeNull();
  });
});

describe('isParticipantNotificationType', () => {
  it.each(['event_participant_added', 'event_participant_removed'])('accepts %s', type => {
    expect(isParticipantNotificationType(type)).toBe(true);
  });

  it.each(['event_invite', 'global', '', undefined, null, 7, {}])('rejects %p', value => {
    expect(isParticipantNotificationType(value)).toBe(false);
  });
});
