import React from 'react';
import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockUser = { id: 'user-me', nickname: 'Sam' };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1',
  organizer_id: 'someone-else',
  sport: 'badminton',
  title: 'Friday doubles',
  visibility: 'public',
  capacity: 12,
  starts_at: '2999-09-25T18:00:00Z',
  ends_at: '2999-09-25T20:00:00Z',
  allow_waitlist: true,
  status: 'upcoming',
  venue_name: 'Hall',
  going_count: 5,
  user_rsvp_status: null,
  skill_level_requirement: 'all_levels',
  my_declined: false,
  ...overrides,
});

async function mount(overrides: Record<string, unknown> = {}): Promise<Instance> {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/participants')) {
      return Promise.resolve({ data: [] });
    }
    if (url.includes('/responses')) {
      return Promise.resolve({
        data: {
          accepted: { total: 1, items: [{ user_id: 'u1', display_name: 'Alice', photo_url: null, waitlisted: false }] },
          pending: { total: 0, items: [] },
          declined: { total: 1, items: [{ user_id: 'u2', display_name: 'Bob', photo_url: null, via: 'invitation' }] },
        },
      });
    }
    return Promise.resolve({ data: rawEvent(overrides) });
  });

  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;

  return renderAsync(<EventDetailScreen {...props} />);
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
});

describe('EventDetailScreen decline and response states', () => {
  it('shows Accept and Decline buttons for an invited user', async () => {
    const root = await mount({ visibility: 'invite_only', user_rsvp_status: null });
    const content = texts(root).join(' ');

    expect(content).toContain('Accept');
    expect(content).toContain('Decline');

    const acceptBtn = pressableLabelled(root, 'Accept');
    await act(async () => {
      acceptBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invitations/respond',
      { accept: true },
      expect.any(Object),
    );
  });

  it('shows Decline button for a joined participant (withdraw)', async () => {
    const root = await mount({ user_rsvp_status: 'going' });
    const content = texts(root).join(' ');

    expect(content).toContain('Decline');

    const declineBtn = pressableLabelled(root, 'Leave');
    await act(async () => {
      declineBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/rsvp',
      { action: 'withdrawn' },
      expect.any(Object),
    );
  });

  it('shows Declined status chip and recovery Accept button when invited game was declined', async () => {
    const root = await mount({ visibility: 'invite_only', my_declined: true });
    const content = texts(root).join(' ');

    expect(content).toContain('Declined');
    expect(content).toContain('Accept');

    const acceptBtn = pressableLabelled(root, 'Accept');
    await act(async () => {
      acceptBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invitations/respond',
      { accept: true },
      expect.any(Object),
    );
  });

  it('shows Declined status chip and Join button when public game was declined', async () => {
    const root = await mount({ visibility: 'public', user_rsvp_status: null, my_declined: true });
    const content = texts(root).join(' ');

    expect(content).toContain('Declined');
    expect(content).toContain('Join');

    const joinBtn = pressableLabelled(root, 'Join');
    await act(async () => {
      joinBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/rsvp',
      { action: 'going' },
      expect.any(Object),
    );
  });

  it('displays refused decline error detail from server', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { detail: 'Decline is not allowed after the game has ended' },
      },
    });

    const root = await mount({ user_rsvp_status: 'going' });
    const declineBtn = pressableLabelled(root, 'Leave');
    await act(async () => {
      declineBtn.props.onPress();
    });

    const content = texts(root).join(' ');
    expect(content).toContain('Decline is not allowed after the game has ended');
  });

  it('renders ResponsesSection for the organizer', async () => {
    const root = await mount({ organizer_id: 'user-me' });
    const content = texts(root).join(' ');

    expect(content).toContain('Responses');
    expect(content).toContain('Accepted');
    expect(content).toContain('Alice');
    expect(content).toContain('Declined');
    expect(content).toContain('Bob');
  });
});
