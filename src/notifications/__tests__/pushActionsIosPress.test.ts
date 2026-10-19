/**
 * iOS-shaped action presses (task pa-clients-ios-press). On iOS a remote push
 * reaches `handlePushActionEvent` (when it reaches JS at all) built by notify-kit's
 * `parseUNNotificationRequest`: `notification.id` is the APNs request identifier,
 * `notification.data` is the push's top-level custom keys (no `tag`, no
 * `notification_id`, no `title`/`body` inside data). These tests cover the JS side
 * only; whether the native press is delivered to JS is NOT covered here.
 */
import { Platform } from 'react-native';
import notifee, { EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { apiClient, refreshAccessTokenForAction } from '../../api/client';
import { perfLog } from '../../diagnostics/perfLog';
import { dispatchNotificationEvent } from '../notificationEventDispatcher';
import { describeNotificationEvent, handlePushActionEvent } from '../pushActions';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  refreshAccessTokenForAction: jest.fn(),
}));
jest.mock('../../diagnostics/perfLog', () => ({ perfLog: jest.fn() }));

const mockPost = apiClient.post as jest.Mock;
const mockRefresh = refreshAccessTokenForAction as jest.Mock;
const mockDisplay = notifee.displayNotification as jest.Mock;
const mockCancel = notifee.cancelNotification as jest.Mock;
const mockPerfLog = perfLog as jest.Mock;

const APNS_REQUEST_ID = 'B2C1F0A4-1111-4222-8333-444455556666';

/** Custom keys only, as `parseDataFromUserInfo` returns them (aps, gcm and google keys stripped). */
function iosData(type: string, extra: Record<string, string> = {}): Record<string, string> {
  return { notification_type: type, entity_id: 'ent-1', delivery_id: 'del-1', ...extra };
}

function iosPress(
  actionId: string,
  data: Record<string, string>,
  id: string | null = APNS_REQUEST_ID,
): Event {
  return {
    type: EventType.ACTION_PRESS,
    detail: {
      notification: { ...(id ? { id } : {}), title: 'Game Invitation', data },
      pressAction: { id: actionId },
    },
  } as Event;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRefresh.mockResolvedValue('tok-new');
  mockDisplay.mockResolvedValue('x');
  mockCancel.mockResolvedValue(undefined);
  mockPost.mockResolvedValue({ data: { participation_status: 'going' } });
  jest.replaceProperty(Platform, 'OS', 'ios');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Accept on an iOS-shaped event_invite', () => {
  it('calls POST /events/{id}/invitations/respond exactly once with the in-memory token', async () => {
    await handlePushActionEvent(iosPress('accept', iosData('event_invite')));

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/events/ent-1/invitations/respond');
    expect(body).toEqual({ accept: true });
    expect(config.headers).toEqual({ Authorization: 'Bearer tok-new' });
    expect(config.correlationId).toEqual(expect.any(String));
  });

  it('replaces the original entry: the result reuses the APNs request id', async () => {
    await handlePushActionEvent(iosPress('accept', iosData('event_invite')));
    expect(mockDisplay.mock.calls[0][0].id).toBe(APNS_REQUEST_ID);
    expect(mockDisplay.mock.calls[0][0].title).toBe("You're in");
  });

  it('with no notification id, falls back to data.delivery_id (still one POST, result keyed by it)', async () => {
    await handlePushActionEvent(iosPress('accept', iosData('event_invite'), null));

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockDisplay.mock.calls[0][0].id).toBe('del-1');
  });

  it('with no id and no delivery_id, does nothing (no POST, no notification)', async () => {
    await handlePushActionEvent(
      iosPress('accept', { notification_type: 'event_invite', entity_id: 'ent-1' }, null),
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockDisplay).not.toHaveBeenCalled();
  });

  it('a second press while the first runs is ignored (one POST)', async () => {
    let release!: (value: unknown) => void;
    mockPost.mockReturnValue(new Promise(resolve => (release = resolve)));
    const event = iosPress('accept', iosData('event_invite'));

    const first = handlePushActionEvent(event);
    const second = handlePushActionEvent(event);
    await Promise.resolve();
    release({ data: {} });
    await Promise.all([first, second]);

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('the guard is keyed by the fallback too: two id-less presses of one delivery make one POST', async () => {
    let release!: (value: unknown) => void;
    mockPost.mockReturnValue(new Promise(resolve => (release = resolve)));
    const event = iosPress('accept', iosData('event_invite'), null);

    const first = handlePushActionEvent(event);
    const second = handlePushActionEvent(event);
    await Promise.resolve();
    release({ data: {} });
    await Promise.all([first, second]);

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('can be pressed again after the first action finished', async () => {
    const event = iosPress('accept', iosData('event_invite'));
    await handlePushActionEvent(event);
    await handlePushActionEvent(event);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});

describe('Ignore on an iOS-shaped event_invite', () => {
  it('clears the entry and marks the delivery read (POST /notifications/{delivery}/read)', async () => {
    await handlePushActionEvent(iosPress('ignore', iosData('event_invite')));

    expect(mockCancel).toHaveBeenCalledWith(APNS_REQUEST_ID);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/notifications/del-1/read');
    expect(mockPost.mock.calls[0][2].headers).toEqual({ Authorization: 'Bearer tok-new' });
  });

  it('with no notification id, cancels by delivery_id and still marks it read', async () => {
    await handlePushActionEvent(iosPress('ignore', iosData('event_invite'), null));
    expect(mockCancel).toHaveBeenCalledWith('del-1');
    expect(mockPost.mock.calls[0][0]).toBe('/notifications/del-1/read');
  });

  it('a double press marks read once', async () => {
    let release!: (value: unknown) => void;
    mockPost.mockReturnValue(new Promise(resolve => (release = resolve)));
    const event = iosPress('ignore', iosData('event_invite'));

    const first = handlePushActionEvent(event);
    const second = handlePushActionEvent(event);
    await Promise.resolve();
    await Promise.resolve();
    release({});
    await Promise.all([first, second]);

    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe('dispatcher with an iOS-shaped event', () => {
  it('routes by the top-level notification_type to the push-action handler', async () => {
    await dispatchNotificationEvent(iosPress('accept', iosData('event_invite')));
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/events/ent-1/invitations/respond');
  });

  it('a press with no notification_type in data is dropped (and logged as route "none")', async () => {
    await dispatchNotificationEvent(iosPress('accept', { entity_id: 'ent-1', delivery_id: 'del-1' }));
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPerfLog).toHaveBeenCalledWith('notif_dispatch', expect.objectContaining({ route: 'none', hasType: false }));
  });
});

describe('diagnostics are shape-only', () => {
  it('records event type, press action, presence flags and data KEY names, never values', async () => {
    await dispatchNotificationEvent(iosPress('accept', iosData('event_invite')));

    const dispatch = mockPerfLog.mock.calls.find(call => call[0] === 'notif_dispatch');
    expect(dispatch?.[1]).toEqual({
      platform: 'ios',
      eventType: EventType.ACTION_PRESS,
      pressAction: 'accept',
      hasNotification: true,
      hasId: true,
      hasType: true,
      hasDeliveryId: true,
      dataKeys: ['notification_type', 'entity_id', 'delivery_id'],
      route: 'push_action',
    });
    expect(mockPerfLog.mock.calls.find(call => call[0] === 'push_action_event')).toBeDefined();

    const everything = JSON.stringify(mockPerfLog.mock.calls);
    for (const secret of [APNS_REQUEST_ID, 'ent-1', 'del-1', 'tok-new', 'Game Invitation']) {
      expect(everything).not.toContain(secret);
    }
  });

  it('an unknown press action id is logged as "other", not verbatim', () => {
    const described = describeNotificationEvent(iosPress('some-user-text', iosData('event_invite')));
    expect(described.pressAction).toBe('other');
  });

  it('logs why an event was skipped', async () => {
    await handlePushActionEvent(
      iosPress('accept', { notification_type: 'event_invite', entity_id: 'ent-1' }, null),
    );
    expect(mockPerfLog).toHaveBeenCalledWith('push_action_skip', { reason: 'no_id_and_no_delivery_id' });
  });
});
