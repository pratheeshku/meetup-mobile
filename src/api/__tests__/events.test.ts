/**
 * Regression test for the HomeScreen crash root cause: `GET /events`
 * returns a bare array of `EventResponse` objects (confirmed against the
 * live backend's OpenAPI schema, 2026-09-18), not the
 * `{ items, total, page, page_size }` envelope this module previously
 * assumed. `getEvents()` must always resolve an `items` array so
 * `HomeScreen`'s `events.length` never sees `undefined`.
 */
import { apiClient } from '../client';
import {
  cancelEvent,
  createEvent,
  getEvents,
  getEventParticipants,
  inviteGroupToEvent,
  inviteUserToEvent,
  rsvpEvent,
  updateEvent,
  withdrawEvent,
} from '../events';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedPatch = apiClient.patch as jest.Mock;

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

describe('rsvpEvent / withdrawEvent (single POST /events/{id}/rsvp endpoint)', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('rsvpEvent posts { action: "going" } to /events/{id}/rsvp', async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    await rsvpEvent('evt-9', { correlationId: 'cid-1' });
    expect(mockedPost).toHaveBeenCalledWith(
      '/events/evt-9/rsvp',
      { action: 'going' },
      { correlationId: 'cid-1' },
    );
  });

  it('withdrawEvent posts { action: "withdrawn" } to the SAME /events/{id}/rsvp (no /withdraw path)', async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    await withdrawEvent('evt-9', { correlationId: 'cid-2' });
    expect(mockedPost).toHaveBeenCalledWith(
      '/events/evt-9/rsvp',
      { action: 'withdrawn' },
      { correlationId: 'cid-2' },
    );
    expect(mockedPost.mock.calls[0][0]).not.toContain('/withdraw');
  });
});

describe('createEvent (Create Flow Amendment, §4.3 — POST /events, EventCreate)', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('POSTs the EventCreate body to /events with the correlation id and maps the response', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        id: 'evt-new',
        organizer_id: 'org-1',
        sport: 'football',
        title: 'Friday Futsal',
        description: null,
        visibility: 'public',
        capacity: 10,
        starts_at: '2026-10-01T18:30:00Z',
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
    });

    const input = {
      title: 'Friday Futsal',
      visibility: 'public' as const,
      skill_level_requirement: 'all_levels' as const,
      capacity: 10,
      starts_at: '2026-10-01T18:30:00.000Z',
      ends_at: null,
    };

    const created = await createEvent(input, { correlationId: 'cid-3' });

    expect(mockedPost).toHaveBeenCalledWith('/events', input, { correlationId: 'cid-3' });
    expect(created).toMatchObject({ id: 'evt-new', title: 'Friday Futsal', visibility: 'public' });
  });

  it('propagates a failed request to the caller', async () => {
    mockedPost.mockRejectedValueOnce(new Error('boom'));
    await expect(
      createEvent({
        title: 'Futsal',
        visibility: 'invite_only',
        skill_level_requirement: 'beginner',
        capacity: 10,
        starts_at: '2026-10-01T18:30:00.000Z',
        ends_at: null,
      }),
    ).rejects.toThrow('boom');
  });
});

describe('cancelEvent (POST /events/{id}/cancel)', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('posts { reason } to /events/{id}/cancel with correlationId', async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    await cancelEvent('evt-1', 'Inclement weather', { correlationId: 'cid-c1' });
    expect(mockedPost).toHaveBeenCalledWith(
      '/events/evt-1/cancel',
      { reason: 'Inclement weather' },
      { correlationId: 'cid-c1' },
    );
  });

  it('propagates cancellation failure', async () => {
    mockedPost.mockRejectedValueOnce(new Error('Cannot cancel'));
    await expect(cancelEvent('evt-1', 'Weather')).rejects.toThrow('Cannot cancel');
  });
});

describe('updateEvent (PATCH /events/{id})', () => {
  afterEach(() => {
    mockedPatch.mockReset();
  });

  it('patches all supported EventUpdate fields and maps the response', async () => {
    mockedPatch.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        organizer_id: 'org-1',
        sport: 'basketball',
        title: 'Updated Kickabout',
        description: 'New description',
        visibility: 'public',
        capacity: 14,
        starts_at: '2026-10-02T10:00:00Z',
        ends_at: '2026-10-02T12:00:00Z',
        estimated_cost_cents: 1000,
        estimated_cost_currency: 'USD',
        allow_waitlist: true,
        recurrence_rule_id: null,
        status: 'upcoming',
        venue_name: 'Main Stadium',
        venue_address: '456 Stadium Way',
        organizer_nickname: 'Alex',
        organizer_display_name: null,
        going_count: 5,
        user_rsvp_status: 'going',
        skill_level_requirement: 'intermediate',
      },
    });

    const updateInput = {
      title: 'Updated Kickabout',
      description: 'New description',
      venue_name: 'Main Stadium',
      venue_address: '456 Stadium Way',
      skill_level_requirement: 'intermediate' as const,
      capacity: 14,
      starts_at: '2026-10-02T10:00:00Z',
      ends_at: '2026-10-02T12:00:00Z',
      visibility: 'public' as const,
      sport: 'basketball',
      allow_waitlist: true,
      estimated_cost_cents: 1000,
      estimated_cost_currency: 'USD',
    };

    const result = await updateEvent('evt-1', updateInput, { correlationId: 'cid-patch' });

    expect(mockedPatch).toHaveBeenCalledWith(
      '/events/evt-1',
      {
        title: 'Updated Kickabout',
        description: 'New description',
        venue_name: 'Main Stadium',
        venue_address: '456 Stadium Way',
        skill_level_requirement: 'intermediate',
        capacity: 14,
        starts_at: '2026-10-02T10:00:00Z',
        ends_at: '2026-10-02T12:00:00Z',
        visibility: 'public',
        sport: 'basketball',
        allow_waitlist: true,
        estimated_cost_cents: 1000,
        estimated_cost_currency: 'USD',
      },
      { correlationId: 'cid-patch' },
    );
    expect(result.title).toBe('Updated Kickabout');
    expect(result.sport).toBe('basketball');
    expect(result.location).toBe('Main Stadium');
    expect(result.venue_address).toBe('456 Stadium Way');
    expect(result.skill_level_requirement).toBe('intermediate');
    expect(result.allow_waitlist).toBe(true);
    expect(result.estimated_cost_cents).toBe(1000);
    expect(result.estimated_cost_currency).toBe('USD');
  });

  it('propagates PATCH failures (e.g. 409 conflict)', async () => {
    mockedPatch.mockRejectedValueOnce(new Error('Visibility is immutable after creation'));
    await expect(
      updateEvent('evt-1', { visibility: 'group' }),
    ).rejects.toThrow('Visibility is immutable after creation');
  });
});

describe('inviteGroupToEvent (POST /events/{id}/invite-group)', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('posts { group_id } to /events/{id}/invite-group and returns invitations', async () => {
    const rawInvites = [
      { id: 'inv-1', event_id: 'evt-1', invitee_user_id: 'user-1', status: 'pending' },
      { id: 'inv-2', event_id: 'evt-1', invitee_user_id: 'user-2', status: 'pending' },
    ];
    mockedPost.mockResolvedValueOnce({ data: rawInvites });

    const result = await inviteGroupToEvent('evt-1', 'grp-9', { correlationId: 'cid-grp' });

    expect(mockedPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-group',
      { group_id: 'grp-9' },
      { correlationId: 'cid-grp' },
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('inv-1');
  });
});

describe('inviteUserToEvent (POST /events/{id}/invite-user)', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('posts { user_id } to /events/{id}/invite-user and returns invitation', async () => {
    const rawInvite = { id: 'inv-3', event_id: 'evt-1', invitee_user_id: 'user-3', status: 'pending' };
    mockedPost.mockResolvedValueOnce({ data: rawInvite });

    const result = await inviteUserToEvent('evt-1', 'user-3', { correlationId: 'cid-usr' });

    expect(mockedPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-user',
      { user_id: 'user-3' },
      { correlationId: 'cid-usr' },
    );
    expect(result.id).toBe('inv-3');
    expect(result.invitee_user_id).toBe('user-3');
  });
});

describe('getEventParticipants (GET /events/{id}/participants)', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('calls /events/{id}/participants and returns array of participants', async () => {
    const participants = [
      { id: 'part-1', user_id: 'user-1', status: 'going', user_nickname: 'PK' },
      { id: 'part-2', user_id: 'user-2', status: 'going', user_nickname: 'RS' },
    ];
    mockedGet.mockResolvedValueOnce({ data: participants });

    const result = await getEventParticipants('evt-1', { correlationId: 'cid-part' });

    expect(mockedGet).toHaveBeenCalledWith(
      '/events/evt-1/participants',
      { correlationId: 'cid-part' },
    );
    expect(result).toHaveLength(2);
    expect(result[0].user_nickname).toBe('PK');
  });
});


