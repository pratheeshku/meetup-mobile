/**
 * The one background dispatcher: notify-kit keeps a single
 * `onBackgroundEvent` handler, so everything routes through it by
 * `notification_type`.
 */
import notifee, { EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { dispatchNotificationEvent, registerNotificationBackgroundDispatcher } from '../notificationEventDispatcher';
import { navigationRef } from '../notificationRouting';
import * as pushActions from '../pushActions';
import * as eventHandler from '../eventNotificationHandler';
import * as participantHandler from '../participantHandler';

const mockOnBackgroundEvent = notifee.onBackgroundEvent as jest.Mock;
const mockCancel = notifee.cancelNotification as jest.Mock;

const isReadySpy = jest.spyOn(navigationRef, 'isReady');
const navigateSpy = jest.spyOn(navigationRef, 'navigate') as unknown as jest.Mock;

function evt(type: EventType, actionId: string | undefined, notificationType: string | undefined): Event {
  return {
    type,
    detail: {
      notification: {
        id: 'n1',
        data: notificationType ? { notification_type: notificationType, entity_id: 'ent-1' } : {},
      },
      ...(actionId ? { pressAction: { id: actionId } } : {}),
    },
  } as Event;
}

beforeEach(() => {
  jest.clearAllMocks();
  isReadySpy.mockReturnValue(true);
  navigateSpy.mockImplementation(() => undefined);
});

describe('registerNotificationBackgroundDispatcher', () => {
  it('registers exactly one background handler: the dispatcher', () => {
    registerNotificationBackgroundDispatcher();
    expect(mockOnBackgroundEvent).toHaveBeenCalledTimes(1);
    expect(mockOnBackgroundEvent).toHaveBeenCalledWith(dispatchNotificationEvent);
  });
});

describe('dispatchNotificationEvent', () => {
  it('participant View press still navigates to the event (the dead handler is alive)', async () => {
    await dispatchNotificationEvent(evt(EventType.ACTION_PRESS, 'view', 'event_participant_added'));
    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'ent-1' },
    });
    expect(mockCancel).toHaveBeenCalledWith('n1');
  });

  it('participant OK press cancels the notification', async () => {
    await dispatchNotificationEvent(evt(EventType.ACTION_PRESS, 'ok', 'event_participant_removed'));
    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('event types go to the event handler', async () => {
    const spy = jest.spyOn(eventHandler, 'handleEventNotificationEvent');
    const participantSpy = jest.spyOn(participantHandler, 'handleParticipantNotificationEvent');
    await dispatchNotificationEvent(evt(EventType.ACTION_PRESS, 'join', 'group_event_created'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(participantSpy).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it.each(['event_invite', 'tournament_invited', 'group_invite'])(
    '%s goes to the push-action handler only',
    async type => {
      const spy = jest.spyOn(pushActions, 'handlePushActionEvent').mockResolvedValue(undefined);
      const participantSpy = jest.spyOn(participantHandler, 'handleParticipantNotificationEvent');
      const eventSpy = jest.spyOn(eventHandler, 'handleEventNotificationEvent');
      await dispatchNotificationEvent(evt(EventType.ACTION_PRESS, 'accept', type));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(participantSpy).not.toHaveBeenCalled();
      expect(eventSpy).not.toHaveBeenCalled();
      spy.mockRestore();
    },
  );

  it('ignores an unknown type and a notification with no data', async () => {
    await dispatchNotificationEvent(evt(EventType.ACTION_PRESS, 'ok', 'global'));
    await dispatchNotificationEvent(evt(EventType.PRESS, 'default', undefined));
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
