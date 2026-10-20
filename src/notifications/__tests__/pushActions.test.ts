/**
 * Push actions (`pushActions.ts`): DES-MEETUP-ADDENDUM-push-actions AD-1, AD-5,
 * AD-7. API and token are mocked; nothing here touches a device.
 */
import { Platform } from 'react-native';
import notifee, { AndroidStyle, EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { apiClient, refreshAccessTokenForAction } from '../../api/client';
import { PLAN_CHANNEL_ID } from '../channels';
import { navigationRef } from '../notificationRouting';
import {
  IOS_ACTIONS_REQUIRE_AUTH,
  PUSH_ACTION_SCOPE,
  displayPushActionNotification,
  getInitialPushActionNotification,
  handlePushActionEvent,
  registerPushActionCategories,
} from '../pushActions';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  refreshAccessTokenForAction: jest.fn(),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;
const mockRefresh = refreshAccessTokenForAction as jest.Mock;
const mockDisplay = notifee.displayNotification as jest.Mock;
const mockCancel = notifee.cancelNotification as jest.Mock;
const mockSetCategories = notifee.setNotificationCategories as jest.Mock;
const mockGetInitial = notifee.getInitialNotification as jest.Mock;

let navigateSpy: jest.Mock;

const TITLE = 'Game Invitation: Sunday   badminton ';
const BODY = 'Sport: badminton\nOrganizer: Ann  \nVenue: Hall 3';

function pushData(type: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    notification_id: 'nid-1',
    notification_type: type,
    entity_id: 'ent-1',
    tag: 'tag-1',
    delivery_id: 'del-1',
    title: TITLE,
    body: BODY,
    ...extra,
  };
}

function press(
  type: EventType,
  actionId: string | undefined,
  data: Record<string, string>,
  id = 'tag-1',
): Event {
  return {
    type,
    detail: {
      notification: { id, data },
      ...(actionId ? { pressAction: { id: actionId } } : {}),
    },
  } as Event;
}

function httpError(status: number, detail?: unknown): Error {
  return Object.assign(new Error('http'), { response: { status, data: { detail } } });
}

function lastResultTitle(): string {
  return mockDisplay.mock.calls[mockDisplay.mock.calls.length - 1][0].title;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRefresh.mockResolvedValue('tok-new');
  mockDisplay.mockResolvedValue('x');
  mockCancel.mockResolvedValue(undefined);
  mockSetCategories.mockResolvedValue(undefined);
  mockGetInitial.mockResolvedValue(null);
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  navigateSpy = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation(() => undefined) as unknown as jest.Mock;
  jest.replaceProperty(Platform, 'OS', 'android');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scope table (AD-1)', () => {
  it('maps the three types to their primary action and iOS category', () => {
    expect(PUSH_ACTION_SCOPE.event_invite).toMatchObject({ primary: 'accept', iosCategory: 'invite_game' });
    expect(PUSH_ACTION_SCOPE.tournament_invited).toMatchObject({
      primary: 'accept',
      iosCategory: 'invite_tournament',
    });
    expect(PUSH_ACTION_SCOPE.group_invite).toMatchObject({ primary: 'leave', iosCategory: 'group_added' });
  });
});

describe('displayPushActionNotification (Android)', () => {
  it.each([
    ['event_invite', 'Accept', 'Decline', 'decline'],
    ['tournament_invited', 'Accept', 'Decline', 'decline'],
    ['group_invite', 'Leave group', 'Ignore', 'ignore'],
  ])(
    '%s: primary button "%s" and secondary button "%s", neither opens the app',
    async (type, primaryTitle, secondaryTitle, secondaryId) => {
      await displayPushActionNotification(pushData(type));

      const arg = mockDisplay.mock.calls[0][0];
      const [primary, secondary] = arg.android.actions;
      expect(primary.title).toBe(primaryTitle);
      expect(secondary.title).toBe(secondaryTitle);
      expect(secondary.pressAction.id).toBe(secondaryId);
      expect(primary.pressAction).not.toHaveProperty('launchActivity');
      expect(secondary.pressAction).not.toHaveProperty('launchActivity');
      expect(arg.android.channelId).toBe(PLAN_CHANNEL_ID);
    },
  );

  it('shows the title and body exactly as received (no trim, no recase)', async () => {
    await displayPushActionNotification(pushData('event_invite'));

    const arg = mockDisplay.mock.calls[0][0];
    expect(arg.title).toBe(TITLE);
    expect(arg.body).toBe(BODY);
    expect(arg.android.style).toEqual({ type: AndroidStyle.BIGTEXT, text: BODY });
  });

  it('attaches the whole data map (delivery_id included) to the notification', async () => {
    const data = pushData('event_invite');
    await displayPushActionNotification(data);
    expect(mockDisplay.mock.calls[0][0].data).toEqual(data);
  });

  it('duplicate FCM delivery: both displays use the tag as id, so the second replaces the first', async () => {
    await displayPushActionNotification(pushData('event_invite'));
    await displayPushActionNotification(pushData('event_invite'));

    expect(mockDisplay.mock.calls[0][0].id).toBe('tag-1');
    expect(mockDisplay.mock.calls[1][0].id).toBe('tag-1');
  });

  it('falls back to notification_id when there is no tag', async () => {
    await displayPushActionNotification(pushData('event_invite', { tag: '' }));
    expect(mockDisplay.mock.calls[0][0].id).toBe('nid-1');
  });

  it('displays nothing for a type outside the scope table', async () => {
    await displayPushActionNotification(pushData('event_changed'));
    expect(mockDisplay).not.toHaveBeenCalled();
  });
});

describe('iOS categories (AD-5, DR-08)', () => {
  it('registers invite_game, invite_tournament and group_added, background actions', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');

    await registerPushActionCategories();

    const categories = mockSetCategories.mock.calls[0][0];
    expect(categories.map((c: { id: string }) => c.id)).toEqual([
      'invite_game',
      'invite_tournament',
      'group_added',
    ]);
    for (const category of categories) {
      for (const action of category.actions) {
        expect(action.foreground).toBe(false);
      }
    }
    const byId = Object.fromEntries(categories.map((c: { id: string }) => [c.id, c]));
    expect(byId.invite_game.actions.map((a: { title: string }) => a.title)).toEqual(['Accept', 'Decline']);
    expect(byId.invite_tournament.actions.map((a: { id: string }) => a.id)).toEqual(['accept', 'decline']);
    expect(byId.group_added.actions.map((a: { title: string }) => a.title)).toEqual([
      'Leave group',
      'Ignore',
    ]);
  });

  it('Accept and Leave group require authentication while the constant is true; secondary never', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(IOS_ACTIONS_REQUIRE_AUTH).toBe(true);

    await registerPushActionCategories();

    for (const category of mockSetCategories.mock.calls[0][0]) {
      const [primary, secondary] = category.actions;
      expect(primary.authenticationRequired).toBe(true);
      expect(secondary.authenticationRequired).toBeUndefined();
    }
  });

  it('does nothing on Android', async () => {
    await registerPushActionCategories();
    expect(mockSetCategories).not.toHaveBeenCalled();
  });
});

describe('Accept game: AD-7 rows', () => {
  const accept = (): Event => press(EventType.ACTION_PRESS, 'accept', pushData('event_invite'));

  it('calls POST /events/{id}/invitations/respond {accept:true} with the in-memory token and one correlation id', async () => {
    mockPost.mockResolvedValue({ data: { participation_status: 'going' } });

    await handlePushActionEvent(accept());

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/events/ent-1/invitations/respond');
    expect(body).toEqual({ accept: true });
    expect(config.headers).toEqual({ Authorization: 'Bearer tok-new' });
    expect(config.correlationId).toEqual(expect.any(String));
  });

  it('200 going → "You\'re in"; the result replaces the original (same id), data keeps the type', async () => {
    mockPost.mockResolvedValue({ data: { participation_status: 'going' } });
    await handlePushActionEvent(accept());
    const arg = mockDisplay.mock.calls[0][0];
    expect(arg.title).toBe("You're in");
    expect(arg.id).toBe('tag-1');
    expect(arg.data).toEqual({
      notification_type: 'event_invite',
      entity_id: 'ent-1',
      push_action_result: '1',
    });
    expect(arg.android).not.toHaveProperty('actions');
  });

  it('200 waitlisted → "You\'re on the waitlist"', async () => {
    mockPost.mockResolvedValue({ data: { participation_status: 'waitlisted' } });
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe("You're on the waitlist");
  });

  it('200 without participation_status → plain "Accepted" (no claim of going)', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('Accepted');
  });

  it('400 refusal → the server reason, then "Open the app."', async () => {
    mockPost.mockRejectedValue(httpError(400, 'Game is cancelled'));
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('Game is cancelled Open the app.');
  });

  it('400 already accepted → "Already accepted"', async () => {
    mockPost.mockRejectedValue(httpError(400, 'Invitation is already accepted'));
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('Already accepted');
  });

  it('404 → "This game is no longer available"', async () => {
    mockPost.mockRejectedValue(httpError(404, 'Invitation not found'));
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('This game is no longer available');
  });
});

describe('Accept tournament: AD-7 rows', () => {
  const accept = (): Event => press(EventType.ACTION_PRESS, 'accept', pushData('tournament_invited'));

  it('calls POST /tournaments/{id}/invitations/respond {accept:true}; 200 → register prompt', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(accept());
    expect(mockPost.mock.calls[0][0]).toBe('/tournaments/ent-1/invitations/respond');
    expect(mockPost.mock.calls[0][1]).toEqual({ accept: true });
    expect(lastResultTitle()).toBe('Accepted. Open the app to register.');
  });

  it('409 → "Invitations are closed"', async () => {
    mockPost.mockRejectedValue(httpError(409));
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('Invitations are closed');
  });

  it('400 → "Already answered"', async () => {
    mockPost.mockRejectedValue(httpError(400));
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('Already answered');
  });

  it('404 → "This tournament is no longer available"', async () => {
    mockPost.mockRejectedValue(httpError(404));
    await handlePushActionEvent(accept());
    expect(lastResultTitle()).toBe('This tournament is no longer available');
  });
});

describe('Decline game: DR-08', () => {
  const decline = (): Event => press(EventType.ACTION_PRESS, 'decline', pushData('event_invite'));

  it('calls POST /events/{id}/invitations/respond {accept:false} with in-memory token', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await handlePushActionEvent(decline());

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/events/ent-1/invitations/respond');
    expect(body).toEqual({ accept: false });
    expect(config.headers).toEqual({ Authorization: 'Bearer tok-new' });
    expect(config.correlationId).toEqual(expect.any(String));
  });

  it('200 → "You declined"', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(decline());
    expect(lastResultTitle()).toBe('You declined');
  });

  it('400 already answered → "Already answered"', async () => {
    mockPost.mockRejectedValue(httpError(400, 'Already answered'));
    await handlePushActionEvent(decline());
    expect(lastResultTitle()).toBe('Already answered');
  });

  it('404 → "This game is no longer available"', async () => {
    mockPost.mockRejectedValue(httpError(404));
    await handlePushActionEvent(decline());
    expect(lastResultTitle()).toBe('This game is no longer available');
  });
});

describe('Decline tournament: DR-08', () => {
  const decline = (): Event => press(EventType.ACTION_PRESS, 'decline', pushData('tournament_invited'));

  it('calls POST /tournaments/{id}/invitations/respond {accept:false} with in-memory token', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await handlePushActionEvent(decline());

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/tournaments/ent-1/invitations/respond');
    expect(body).toEqual({ accept: false });
    expect(config.headers).toEqual({ Authorization: 'Bearer tok-new' });
  });

  it('200 → "You declined"', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(decline());
    expect(lastResultTitle()).toBe('You declined');
  });

  it('400 already answered → "Already answered"', async () => {
    mockPost.mockRejectedValue(httpError(400));
    await handlePushActionEvent(decline());
    expect(lastResultTitle()).toBe('Already answered');
  });

  it('404 → "This game is no longer available"', async () => {
    mockPost.mockRejectedValue(httpError(404));
    await handlePushActionEvent(decline());
    expect(lastResultTitle()).toBe('This game is no longer available');
  });
});

describe('Leave group: AD-7 rows', () => {
  const leave = (): Event => press(EventType.ACTION_PRESS, 'leave', pushData('group_invite'));

  beforeEach(() => {
    mockGet.mockImplementation(async (url: string) =>
      url === '/users/me' ? { data: { id: 'user-9' } } : { data: { name: 'Sunday Smashers' } },
    );
    mockDelete.mockResolvedValue({ status: 204 });
  });

  it('DELETEs /groups/{group_id}/members/{user_id} with the caller id; 200 → "You left {group}"', async () => {
    await handlePushActionEvent(leave());

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete.mock.calls[0][0]).toBe('/groups/ent-1/members/user-9');
    expect(mockDelete.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer tok-new' });
    expect(lastResultTitle()).toBe('You left Sunday Smashers');
  });

  it('uses one correlation id for every call of the action', async () => {
    await handlePushActionEvent(leave());
    const ids = [...mockGet.mock.calls, ...mockDelete.mock.calls].map(c => c[c.length - 1].correlationId);
    expect(new Set(ids).size).toBe(1);
  });

  it('group name unreadable → "You left the group" and the leave still happens', async () => {
    mockGet.mockImplementation(async (url: string) => {
      if (url === '/users/me') {
        return { data: { id: 'user-9' } };
      }
      throw httpError(500);
    });
    await handlePushActionEvent(leave());
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(lastResultTitle()).toBe('You left the group');
  });

  it('400 → "Owners can\'t leave. Open the app."', async () => {
    mockDelete.mockRejectedValue(httpError(400, 'Owners cannot leave the group. Transfer ownership first.'));
    await handlePushActionEvent(leave());
    expect(lastResultTitle()).toBe("Owners can't leave. Open the app.");
  });

  it('404 → "You\'re no longer in this group"', async () => {
    mockDelete.mockRejectedValue(httpError(404));
    await handlePushActionEvent(leave());
    expect(lastResultTitle()).toBe("You're no longer in this group");
  });

  it('caller id unavailable → generic message, no DELETE', async () => {
    mockGet.mockRejectedValue(httpError(500));
    await handlePushActionEvent(leave());
    expect(mockDelete).not.toHaveBeenCalled();
    expect(lastResultTitle()).toBe("Couldn't complete this. Open the app.");
  });
});

describe('generic failures (any action)', () => {
  const generic = "Couldn't complete this. Open the app.";

  it.each([
    ['401 after refresh', httpError(401)],
    ['network error', Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })],
    ['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })],
    ['5xx', httpError(503)],
  ])('game Accept, %s → generic message', async (_name, error) => {
    mockPost.mockRejectedValue(error);
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'accept', pushData('event_invite')));
    expect(lastResultTitle()).toBe(generic);
  });

  it('refresh fails (session ended / offline) → generic message and no endpoint call', async () => {
    mockRefresh.mockRejectedValue(new Error('refresh failed'));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'accept', pushData('tournament_invited')));
    expect(mockPost).not.toHaveBeenCalled();
    expect(lastResultTitle()).toBe(generic);
  });

  it('missing entity_id → generic message, no calls', async () => {
    await handlePushActionEvent(
      press(EventType.ACTION_PRESS, 'accept', pushData('event_invite', { entity_id: '' })),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(lastResultTitle()).toBe(generic);
  });

  it('makes no connectivity pre-check (D-4): the first thing that runs is the refresh', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'accept', pushData('event_invite')));
    expect(mockRefresh.mock.invocationCallOrder[0]).toBeLessThan(mockPost.mock.invocationCallOrder[0]);
  });
});

describe('Ignore', () => {
  const ignore = (data = pushData('group_invite')): Event =>
    press(EventType.ACTION_PRESS, 'ignore', data);

  it('cancels the tray entry first, then marks the DELIVERY id read (not notification_id)', async () => {
    mockPost.mockResolvedValue({ status: 204 });

    await handlePushActionEvent(ignore());

    expect(mockCancel).toHaveBeenCalledWith('tag-1');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/notifications/del-1/read');
    expect(mockPost.mock.calls[0][0]).not.toContain('nid-1');
    expect(mockCancel.mock.invocationCallOrder[0]).toBeLessThan(mockPost.mock.invocationCallOrder[0]);
    expect(mockDisplay).not.toHaveBeenCalled(); // no result message for Ignore
  });

  it('ignore on event_invite is skipped because Ignore was removed for invitations (D-1)', async () => {
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'ignore', pushData('event_invite')));
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('never calls a respond, join or leave endpoint', async () => {
    mockPost.mockResolvedValue({ status: 204 });
    await handlePushActionEvent(ignore());
    expect(mockDelete).not.toHaveBeenCalled();
    for (const call of mockPost.mock.calls) {
      expect(call[0]).toMatch(/^\/notifications\/.+\/read$/);
    }
  });

  it('a mark-read failure is swallowed (best effort)', async () => {
    mockPost.mockRejectedValue(httpError(500));
    await expect(handlePushActionEvent(ignore())).resolves.toBeUndefined();
    expect(mockCancel).toHaveBeenCalledWith('tag-1');
  });

  it('without a delivery_id it only clears the entry and does no token work', async () => {
    await handlePushActionEvent(ignore(pushData('group_invite', { delivery_id: '' })));
    expect(mockCancel).toHaveBeenCalledWith('tag-1');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('in-flight guard', () => {
  it('ignores a second press on the same notification while one runs', async () => {
    let release: (value: unknown) => void = () => undefined;
    mockPost.mockImplementation(() => new Promise(resolve => (release = resolve)));
    const event = press(EventType.ACTION_PRESS, 'accept', pushData('event_invite'));

    const first = handlePushActionEvent(event);
    await Promise.resolve();
    await handlePushActionEvent(event); // second press: returns at once
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'decline', pushData('event_invite')));

    release({ data: { participation_status: 'going' } });
    await first;

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('releases the guard when the action settles, so a later press runs again', async () => {
    mockPost.mockResolvedValue({ data: { participation_status: 'going' } });
    const event = press(EventType.ACTION_PRESS, 'accept', pushData('event_invite'));
    await handlePushActionEvent(event);
    await handlePushActionEvent(event);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});

describe('taps and result notifications', () => {
  it('a body tap opens the entity (EventDetail for event_invite)', async () => {
    await handlePushActionEvent(press(EventType.PRESS, 'default', pushData('event_invite')));
    expect(navigateSpy).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'ent-1' },
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('a tap on a result notification opens the entity and never re-runs the action', async () => {
    const data = { notification_type: 'group_invite', entity_id: 'ent-1', push_action_result: '1' };
    await handlePushActionEvent(press(EventType.PRESS, 'default', data));
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'leave', data));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('ignores types outside the scope table', async () => {
    await handlePushActionEvent(
      press(EventType.ACTION_PRESS, 'accept', pushData('event_changed')),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockDisplay).not.toHaveBeenCalled();
  });

  it('quit-state launch from a body tap resolves the payload', async () => {
    mockGetInitial.mockResolvedValue({
      notification: { id: 'x', data: pushData('tournament_invited') },
      pressAction: { id: 'default' },
    });
    await expect(getInitialPushActionNotification()).resolves.toMatchObject({
      notification_type: 'tournament_invited',
      entity_id: 'ent-1',
    });
  });

  it('quit-state launch from an action button is not a navigation', async () => {
    mockGetInitial.mockResolvedValue({
      notification: { id: 'x', data: pushData('tournament_invited') },
      pressAction: { id: 'accept' },
    });
    await expect(getInitialPushActionNotification()).resolves.toBeNull();
  });
});

describe('logging (R-111)', () => {
  it('logs nothing: no title, body, id or token reaches console', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPost.mockRejectedValue(httpError(400, 'Game is cancelled'));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'accept', pushData('event_invite')));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'ignore', pushData('event_invite'), 'tag-2'));
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
