/**
 * DES-MEETUP-ADDENDUM-priority1-nov23 on the game page:
 * - P1-04/P1-05: Decline on a joined game records the decline (POST /decline, not a plain withdraw), and a declined
 *   player's button reads Accept on every game;
 * - P1-06: Share status captures the page and opens the share sheet;
 * - P1-07: Add to calendar opens the calendar entry (iOS: the .ics preview).
 */
import React from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: { dirs: { CacheDir: '/cache' }, writeFile: jest.fn(() => Promise.resolve()), unlink: jest.fn() },
    ios: { openDocument: jest.fn(() => Promise.resolve()), presentOptionsMenu: jest.fn() },
  },
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const viewShot = jest.requireMock('react-native-view-shot') as { captureRef: jest.Mock };
const share = (jest.requireMock('react-native-share') as { default: { open: jest.Mock; shareSingle: jest.Mock } }).default;

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'someone-else', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 12, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 5, user_rsvp_status: null, skill_level_requirement: 'all_levels',
  ...overrides,
});

async function mount(overrides: Record<string, unknown> = {}): Promise<Instance> {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/participants') ? [] : rawEvent(overrides) }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const press = async (root: Instance, label: string): Promise<void> => {
  await act(async () => {
    await pressableLabelled(root, label).props.onPress();
  });
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  viewShot.captureRef.mockClear();
  share.open.mockClear();
  share.shareSingle.mockClear();
  __resetSportDisplayNamesCacheForTests();
});

describe('P1-04 / P1-05: decline on a joined game', () => {
  it('a going player\'s Decline calls the decline route, never the plain withdraw', async () => {
    const root = await mount({ user_rsvp_status: 'going' });
    await press(root, 'Decline');
    const urls = mockPost.mock.calls.map(call => call[0]);
    expect(urls).toContain('/events/evt-1/decline');
    expect(mockPost.mock.calls.some(call => call[0] === '/events/evt-1/rsvp' && call[1]?.action === 'withdrawn')).toBe(false);
  });

  it.each(['public', 'group', 'invite_only'])('a declined player sees Accept on a %s game', async visibility => {
    const root = await mount({ my_declined: true, visibility });
    expect(texts(root)).toContain('Accept');
    expect(texts(root)).not.toContain('Register');
    expect(texts(root)).not.toContain('Join');
  });

  it('Accept on a declined public game joins (RSVP going)', async () => {
    const root = await mount({ my_declined: true, visibility: 'public' });
    await press(root, 'Accept');
    expect(mockPost.mock.calls.some(call => call[0] === '/events/evt-1/rsvp')).toBe(true);
  });
});

describe('P1-06: share status', () => {
  it('captures the whole page and opens the share sheet with the image', async () => {
    const root = await mount();
    await press(root, 'Share a screenshot of who accepted, declined and is pending');
    expect(viewShot.captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshotContentContainer: true, result: 'tmpfile' }));
    expect(share.open).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///tmp/status.png', type: 'image/png' }));
  });

  it('shows the error text when the capture fails, and nothing when the person cancels', async () => {
    viewShot.captureRef.mockRejectedValueOnce(new Error('boom'));
    const root = await mount();
    await press(root, 'Share a screenshot of who accepted, declined and is pending');
    expect(texts(root)).toContain('Could not share the screenshot.');

    share.open.mockRejectedValueOnce(new Error('User did not share'));
    const again = await mount();
    await press(again, 'Share a screenshot of who accepted, declined and is pending');
    expect(texts(again)).not.toContain('Could not share the screenshot.');
  });
});

describe('P1-07: add to calendar', () => {
  it('offers Add to calendar on an upcoming game and opens the entry', async () => {
    const root = await mount();
    await press(root, 'Add to calendar');
    expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalledWith('/cache/game-evt-1.ics', expect.stringContaining('SUMMARY:Friday doubles'), 'utf8');
    expect(ReactNativeBlobUtil.ios.openDocument).toHaveBeenCalledWith('/cache/game-evt-1.ics');
  });

  it('does not offer it on a cancelled game', async () => {
    const root = await mount({ status: 'cancelled' });
    expect(texts(root)).not.toContain('Add to calendar');
  });
});
