/** Remarks on the game view (team-screens-remarks AD-4, TS-11, TS-T13): a section only when non-empty, plain text. */
import React from 'react';

import { apiClient } from '../../api/client';
import { renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1',
  organizer_id: 'someone-else',
  sport: 'badminton',
  title: 'Sunday Smash Doubles',
  visibility: 'public',
  capacity: 8,
  starts_at: '2999-10-24T11:00:00Z',
  ends_at: '2999-10-24T13:00:00Z',
  allow_waitlist: true,
  status: 'upcoming',
  venue_name: 'Our Tampines Hub',
  venue_address: '1 Tampines Walk',
  going_count: 2,
  user_rsvp_status: null,
  skill_level_requirement: 'all_levels',
  ...overrides,
});

async function mount(event: Record<string, unknown> = {}): Promise<Instance> {
  mockGet.mockImplementation((url: string) => {
    if (url === '/config/client') return Promise.resolve({ data: { venue_catalogue_enabled: true } });
    if (url.includes('/participants')) return Promise.resolve({ data: [] });
    if (url.includes('/responses')) return Promise.reject({ response: { status: 403, data: { detail: 'Forbidden' } } });
    if (url.includes('/closure')) return Promise.reject({ response: { status: 404 } });
    return Promise.resolve({ data: rawEvent(event) });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const remarks = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'event-remarks' && typeof n.type === 'string');

beforeEach(() => {
  mockGet.mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('Remarks section', () => {
  it('shows the title and the text when the game has remarks', async () => {
    const root = await mount({ description: 'Bring your own shuttles.\nCourt 3' });
    expect(texts(root)).toContain('Remarks');
    expect(remarks(root)).toHaveLength(1);
    expect(texts(root)).toContain('Bring your own shuttles.\nCourt 3');
  });

  it.each([[''], ['   '], [null]])('is not drawn when the remarks are %p', async description => {
    const root = await mount({ description });
    expect(remarks(root)).toHaveLength(0);
    expect(texts(root)).not.toContain('Remarks');
  });

  it('shows markup and links as typed: plain text, never interpreted', async () => {
    const root = await mount({ description: '<b>bold</b> https://example.com' });
    expect(texts(root)).toContain('<b>bold</b> https://example.com');
  });
});
