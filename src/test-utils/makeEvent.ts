/**
 * Test-only `Event` factory shared by the Home dashboard tests. Not imported
 * by any production module.
 */
import type { Event } from '../types/event';

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    title: 'Friday night doubles',
    description: '',
    sport: 'badminton',
    location: 'Riverside Courts',
    starts_at: '2026-09-25T18:00:00Z',
    ends_at: '2026-09-25T20:00:00Z',
    capacity: 12,
    participant_count: 5,
    waitlist_count: 0,
    visibility: 'public',
    status: 'upcoming',
    organiser_id: 'someone-else',
    organiser_nickname: 'org',
    is_recurring: false,
    cost: null,
    current_user_rsvp_status: 'none',
    is_organiser: false,
    ...overrides,
  };
}
