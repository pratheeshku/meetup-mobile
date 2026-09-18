/**
 * Regression test for the HomeScreen crash root cause: `GET /events`
 * returns a bare array of `EventResponse` objects (confirmed against the
 * live backend's OpenAPI schema, 2026-09-18), not the
 * `{ items, total, page, page_size }` envelope this module previously
 * assumed. `getEvents()` must always resolve an `items` array so
 * `HomeScreen`'s `events.length` never sees `undefined`.
 */
import { apiClient } from '../client';
import { getEvents } from '../events';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;

describe('getEvents', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('wraps the backend\'s bare array response into { items, total, page, page_size }', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 'evt-1',
          organizer_id: 'org-1',
          sport: 'Football',
          title: 'Sunday Kickabout',
          description: 'Casual 5-a-side',
          visibility: 'public',
          capacity: 10,
          starts_at: '2026-09-20T10:00:00Z',
          ends_at: '2026-09-20T11:00:00Z',
          estimated_cost_cents: 500,
          recurrence_rule_id: null,
          status: 'upcoming',
          venue_name: 'Riverside Pitch',
          venue_address: '1 River Rd',
          organizer_nickname: 'Alex',
          organizer_display_name: 'Alex J',
          going_count: 4,
          user_rsvp_status: 'going',
        },
      ],
    });

    const result = await getEvents();

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'evt-1',
      title: 'Sunday Kickabout',
      location: 'Riverside Pitch',
      participant_count: 4,
      current_user_rsvp_status: 'going',
    });
  });

  it('passes a null ends_at through as null (not an empty string)', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 'evt-2',
          organizer_id: 'org-1',
          sport: 'Football',
          title: 'Open-ended session',
          description: null,
          visibility: 'public',
          capacity: 10,
          starts_at: '2026-09-20T10:00:00Z',
          ends_at: null,
          estimated_cost_cents: null,
          recurrence_rule_id: null,
          status: 'upcoming',
          venue_name: null,
          venue_address: null,
          organizer_nickname: null,
          organizer_display_name: null,
          going_count: 0,
          user_rsvp_status: null,
        },
      ],
    });

    const result = await getEvents();

    expect(result.items[0].ends_at).toBeNull();
  });

  it('never resolves an undefined items array, even for an empty feed', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });

    const result = await getEvents();

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});
