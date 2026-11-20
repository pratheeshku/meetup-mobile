/** Organizer Remind on a Pending row, through the game screen (DES-MEETUP-ADDENDUM-invite-reminder v1.0.2). */
import React from 'react';
import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const rawEvent = {
  id: 'evt-1',
  organizer_id: 'user-me',
  sport: 'badminton',
  title: 'Friday doubles',
  visibility: 'invite_only',
  capacity: 12,
  starts_at: '2999-09-25T18:00:00Z',
  ends_at: '2999-09-25T20:00:00Z',
  allow_waitlist: true,
  status: 'upcoming',
  venue_name: 'Hall',
  going_count: 1,
  user_rsvp_status: 'going',
  skill_level_requirement: 'all_levels',
  my_declined: false,
};

const pendingPerson = { user_id: 'p1', display_name: 'Priya', can_remind: true, reminder_count: 0, last_reminded_at: null };

async function mount(): Promise<Instance> {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/participants')) {
      return Promise.resolve({ data: [] });
    }
    if (url.includes('/responses')) {
      return Promise.resolve({
        data: {
          accepted: { total: 1, items: [{ user_id: 'user-me', display_name: 'Sam' }] },
          pending: { total: 1, items: [pendingPerson] },
          declined: { total: 0, items: [] },
        },
      });
    }
    return Promise.resolve({ data: rawEvent });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const remindButton = (root: Instance): Instance =>
  root.find(n => n.props.testID === 'remind-button-0' && typeof n.props.onPress === 'function');
const responsesCalls = (): number => mockGet.mock.calls.filter(([url]) => String(url).includes('/responses')).length;

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe('EventDetailScreen reminder', () => {
  it('sends POST /events/{id}/reminders for that person, then shows the sent row', async () => {
    const root = await mount();
    const now = new Date().toISOString();
    mockPost.mockResolvedValueOnce({ data: { sent_at: now, last_reminded_at: now, reminder_count: 1 } });

    await act(async () => remindButton(root).props.onPress());

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/reminders',
      { user_id: 'p1' },
      { correlationId: expect.any(String) },
    );
    const content = texts(root).join(' | ');
    expect(content).toContain('Reminder sent');
    expect(content).toContain('Reminded Just now');
  });

  it('REMINDER_NOT_PENDING reloads the list and says the person already replied', async () => {
    const root = await mount();
    const before = responsesCalls();
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { code: 'REMINDER_NOT_PENDING' } } });

    await act(async () => remindButton(root).props.onPress());

    expect(responsesCalls()).toBe(before + 1);
    expect(texts(root).join(' | ')).toContain('This person has already replied');
  });

  it('a network failure shows "Could not send reminder" and leaves Remind for a retry', async () => {
    const root = await mount();
    mockPost.mockRejectedValueOnce(new Error('Network Error'));

    await act(async () => remindButton(root).props.onPress());

    expect(texts(root).join(' | ')).toContain('Could not send reminder');
    expect(remindButton(root)).toBeDefined();
  });
});
