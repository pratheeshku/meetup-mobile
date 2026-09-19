/**
 * Foreground handler (`onMessage` in `fcm.ts`) with the two participant
 * types: a known type shows the banner from the payload's own title/body; a
 * missing `entity_id` still shows (as an empty id, which routing handles);
 * an unknown type is still dropped.
 */
import * as firebaseMessaging from '@react-native-firebase/messaging';

import { onMessage } from '../fcm';
import { dismissBanner, getBannerState } from '../notificationBannerStore';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn(), delete: jest.fn() } }));

const mockOnMessage = firebaseMessaging.onMessage as jest.Mock;

type Handler = (message: unknown) => void;
let deliver: Handler;

beforeEach(() => {
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
])('%s', (type, title, body) => {
  it('shows the banner with the payload title, body and entity id', () => {
    deliver({
      messageId: 'm1',
      data: { notification_type: type, entity_id: 'evt-7', title, body },
    });

    expect(getBannerState()).toEqual({
      notification_type: type,
      entity_id: 'evt-7',
      title,
      body,
    });
  });

  it('falls back to the FCM notification block for title/body', () => {
    deliver({
      messageId: 'm2',
      data: { notification_type: type, entity_id: 'evt-7' },
      notification: { title, body },
    });

    expect(getBannerState()).toMatchObject({ title, body });
  });

  it('handles a missing entity_id safely: banner still shows, with an empty id', () => {
    expect(() =>
      deliver({ messageId: 'm3', data: { notification_type: type, title, body } }),
    ).not.toThrow();

    expect(getBannerState()).toEqual({
      notification_type: type,
      entity_id: '',
      title,
      body,
    });
  });

  it('handles a non-string entity_id safely', () => {
    deliver({ messageId: 'm4', data: { notification_type: type, entity_id: 123, title, body } });

    expect(getBannerState()?.entity_id).toBe('');
  });
});

it('still drops a type the app does not know (unchanged behaviour)', () => {
  deliver({
    messageId: 'm5',
    data: { notification_type: 'event_something_new', entity_id: 'evt-1', title: 't', body: 'b' },
  });

  expect(getBannerState()).toBeNull();
});
