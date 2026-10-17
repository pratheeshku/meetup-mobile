/**
 * Regression tests for the full-contract-audit fixes to
 * `api/tournaments.ts` (docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md),
 * using fixtures built from the real backend's confirmed OpenAPI schemas
 * (`TournamentResponse`, `TournamentRegistrationResponse`).
 */
import { apiClient } from '../client';
import {
  createTournament,
  getRegistrations,
  getTournament,
  getTournaments,
  inviteEmailToTournament,
  inviteGroupToTournament,
  inviteUserToTournament,
  respondToTournamentInvitation,
} from '../tournaments';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getTournaments list mapping (registered_count / my_registration_status)', () => {
  const base = {
    id: 't-9', organizer_id: 'org-1', sport: 'football', title: 'Cup', name: null, description: null,
    format: 'knockout', capacity: 8, registration_closes_at: '2999-01-01T00:00:00Z',
    starts_at: '2999-02-01T00:00:00Z', status: 'upcoming', created_at: '2026-01-01T00:00:00Z',
  };

  it('maps count, own status, venue fields and registration_closes_at; derives is_organiser', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{
        ...base, registered_count: 5, my_registration_status: 'registered',
        venue_name: 'Hall A', venue_label: 'Hall A, SG', venue_id: 'v-1',
        venue_snapshot: { name: 'Hall A' },
      }],
    });
    const [item] = (await getTournaments({ currentUserId: 'org-1' })).items;
    expect(item).toMatchObject({
      participant_count: 5,
      current_user_registration_status: 'registered',
      venue_name: 'Hall A',
      venue_label: 'Hall A, SG',
      venue_id: 'v-1',
      registration_closes_at: '2999-01-01T00:00:00Z',
      is_organiser: true,
    });
    expect(item.venue_snapshot).toEqual({ name: 'Hall A' });
  });

  it('keeps 0 as 0, but null or absent count/status stay null (unknown)', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        { ...base, registered_count: 0, my_registration_status: 'none' },
        { ...base, id: 't-10', registered_count: null, my_registration_status: null },
        { ...base, id: 't-11' },
      ],
    });
    const items = (await getTournaments({ currentUserId: 'someone' })).items;
    expect(items[0].participant_count).toBe(0);
    expect(items[0].current_user_registration_status).toBe('none');
    expect(items[1].participant_count).toBeNull();
    expect(items[1].current_user_registration_status).toBeNull();
    expect(items[2].participant_count).toBeNull();
    expect(items[2].current_user_registration_status).toBeNull();
    expect(items[0].is_organiser).toBe(false);
  });

  it('is_organiser is false when no current user is given', async () => {
    mockedGet.mockResolvedValueOnce({ data: [base] });
    expect((await getTournaments()).items[0].is_organiser).toBe(false);
  });
});

describe('getTournaments', () => {
  it('wraps the backend\'s bare array response and maps title->name, capacity->max_participants', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 't-1',
          organizer_id: 'org-1',
          sport: 'Football',
          title: 'Summer Cup',
          name: null,
          description: 'A cup',
          format: 'knockout',
          capacity: 16,
          registration_closes_at: null,
          starts_at: '2026-10-01T10:00:00Z',
          status: 'upcoming',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const result = await getTournaments();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 't-1',
      name: 'Summer Cup',
      organiser_id: 'org-1',
      max_participants: 16,
      registration_open: true,
    });
    // Not derivable without a per-tournament extra call — must be the
    // flagged placeholder, never a guessed real-looking value.
    expect(result.items[0].organiser_nickname).toBe('');
    expect(result.items[0].current_user_registration_status).toBeNull();
    expect(result.items[0].participant_count).toBeNull();
  });

  it('derives registration_open=false once registration_closes_at is in the past', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 't-2',
          organizer_id: 'org-1',
          sport: 'Football',
          title: 'Past Cup',
          name: null,
          description: null,
          format: 'league',
          capacity: 8,
          registration_closes_at: '2020-01-01T00:00:00Z',
          starts_at: '2020-02-01T10:00:00Z',
          status: 'completed',
          created_at: '2019-01-01T00:00:00Z',
        },
      ],
    });

    const result = await getTournaments();
    expect(result.items[0].registration_open).toBe(false);
  });
});

describe('getTournament', () => {
  it('maps a single TournamentResponse the same way as the list', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        id: 't-1',
        organizer_id: 'org-1',
        sport: 'Football',
        title: 'Summer Cup',
        name: null,
        description: 'A cup',
        format: 'knockout',
        capacity: 16,
        registration_closes_at: null,
        starts_at: '2026-10-01T10:00:00Z',
        status: 'upcoming',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    const result = await getTournament('t-1');
    expect(result.name).toBe('Summer Cup');
    expect(result.max_participants).toBe(16);
  });
});

describe('getRegistrations', () => {
  it('maps participant_name->nickname and carries through status/nullable user_id', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 'r-1',
          tournament_id: 't-1',
          user_id: null,
          team_id: 'team-1',
          registered_by_user_id: 'u-1',
          status: 'registered',
          seed_number: null,
          declared_skill_score: null,
          strength_score: null,
          registered_at: '2026-01-05T00:00:00Z',
          participant_name: 'The Strikers',
        },
      ],
    });

    const result = await getRegistrations('t-1');
    expect(result[0]).toMatchObject({
      id: 'r-1',
      user_id: null,
      nickname: 'The Strikers',
      status: 'registered',
    });
  });
});

describe('createTournament', () => {
  const response = {
    id: 't-new',
    organizer_id: 'org-1',
    sport: 'football',
    title: 'Summer Cup',
    name: null,
    description: null,
    format: 'knockout',
    capacity: 8,
    registration_closes_at: null,
    starts_at: '2026-10-01T10:00:00Z',
    status: 'upcoming',
    created_at: '2026-09-19T00:00:00Z',
  };

  afterEach(() => {
    mockedPost.mockReset();
  });

  it('POSTs the TournamentCreate field names to /tournaments with the correlation id', async () => {
    mockedPost.mockResolvedValueOnce({ data: response });
    const input = {
      title: 'Summer Cup',
      sport: 'football',
      visibility: 'public' as const,
      participation_mode: 'individual' as const,
      format: 'knockout' as const,
      capacity: 8,
      starts_at: '2026-10-01T10:00:00.000Z',
      registration_closes_at: '2026-09-30T10:00:00.000Z',
    };

    await createTournament(input, { correlationId: 'cid-2' });

    expect(mockedPost).toHaveBeenCalledWith('/tournaments', input, { correlationId: 'cid-2' });
  });

  it('maps the TournamentResponse (title -> name, capacity -> max_participants)', async () => {
    mockedPost.mockResolvedValueOnce({ data: response });

    const created = await createTournament({
      title: 'Summer Cup',
      sport: 'football',
      visibility: 'public',
      participation_mode: 'team',
      format: 'knockout',
      capacity: 8,
      starts_at: '2026-10-01T10:00:00.000Z',
    });

    expect(created).toMatchObject({ id: 't-new', name: 'Summer Cup', max_participants: 8 });
  });

  it('forwards venue_id and never sends venue_name, venue_snapshot, address, lat, or lng', async () => {
    mockedPost.mockResolvedValueOnce({ data: response });
    const input = {
      title: 'Summer Cup',
      sport: 'football',
      visibility: 'public' as const,
      participation_mode: 'team' as const,
      format: 'knockout' as const,
      capacity: 8,
      starts_at: '2026-10-01T10:00:00.000Z',
      venue_id: 'v-101',
    };

    await createTournament(input, { correlationId: 'cid-venue' });

    expect(mockedPost).toHaveBeenCalledWith('/tournaments', input, { correlationId: 'cid-venue' });
    expect(input).not.toHaveProperty('venue_name');
    expect(input).not.toHaveProperty('venue_snapshot');
    expect(input).not.toHaveProperty('address');
    expect(input).not.toHaveProperty('lat');
    expect(input).not.toHaveProperty('lng');
  });

  it('forwards others and never sends venue_name, venue_id, venue_snapshot, address, lat, or lng', async () => {
    mockedPost.mockResolvedValueOnce({ data: response });
    const input = {
      title: 'Summer Cup',
      sport: 'football',
      visibility: 'public' as const,
      participation_mode: 'team' as const,
      format: 'knockout' as const,
      capacity: 8,
      starts_at: '2026-10-01T10:00:00.000Z',
      others: {
        name: 'Custom Court',
        postal_code: '123456',
        facilities: ['Field 1'],
      },
    };

    await createTournament(input, { correlationId: 'cid-others' });

    expect(mockedPost).toHaveBeenCalledWith('/tournaments', input, { correlationId: 'cid-others' });
    expect(input).not.toHaveProperty('venue_name');
    expect(input).not.toHaveProperty('venue_id');
    expect(input).not.toHaveProperty('venue_snapshot');
    expect(input).not.toHaveProperty('address');
    expect(input).not.toHaveProperty('lat');
    expect(input).not.toHaveProperty('lng');
  });

  it('propagates a failed request to the caller', async () => {
    mockedPost.mockRejectedValueOnce(new Error('boom'));
    await expect(
      createTournament({
        title: 'T',
        sport: 'football',
        visibility: 'public',
        participation_mode: 'team',
        format: 'knockout',
        capacity: 8,
        starts_at: '2026-10-01T10:00:00.000Z',
      }),
    ).rejects.toThrow('boom');
  });
});

describe('invite capability and invitation status (my_invite_access / my_invitation_status)', () => {
  const base = {
    id: 't-9', organizer_id: 'org-1', sport: 'football', title: 'Cup', name: null, description: null,
    format: 'knockout', capacity: 8, registration_closes_at: null,
    starts_at: '2999-02-01T00:00:00Z', status: 'upcoming', created_at: '2026-01-01T00:00:00Z',
  };

  it.each([['full'], ['individuals'], ['none']])('maps my_invite_access %s', async access => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, my_invite_access: access } });
    expect((await getTournament('t-9')).my_invite_access).toBe(access);
  });

  it.each([[null], [undefined], ['admin'], ['']])('treats %p as none (never shows buttons)', async access => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, my_invite_access: access } });
    expect((await getTournament('t-9')).my_invite_access).toBe('none');
  });

  it.each([['pending'], ['accepted']])('maps my_invitation_status %s', async status => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, my_invitation_status: status } });
    expect((await getTournament('t-9')).my_invitation_status).toBe(status);
  });

  it.each([[null], [undefined], ['declined'], ['revoked']])('treats %p as no invitation', async status => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, my_invitation_status: status } });
    expect((await getTournament('t-9')).my_invitation_status).toBeNull();
  });

  it('list items without the fields map to none / null', async () => {
    mockedGet.mockResolvedValueOnce({ data: [base] });
    const [item] = (await getTournaments()).items;
    expect(item.my_invite_access).toBe('none');
    expect(item.my_invitation_status).toBeNull();
  });
});

describe('invitation calls', () => {
  it('post to the contract paths with the contract bodies and the correlation id', async () => {
    mockedPost.mockReset().mockResolvedValue({ data: {} });
    await inviteUserToTournament('t-1', 'u-1', { correlationId: 'c' });
    await inviteGroupToTournament('t-1', 'g-1', { correlationId: 'c' });
    await inviteEmailToTournament('t-1', 'a@b.co', { correlationId: 'c' });
    await respondToTournamentInvitation('t-1', true, { correlationId: 'c' });
    await respondToTournamentInvitation('t-1', false, { correlationId: 'c' });
    expect(mockedPost.mock.calls).toEqual([
      ['/tournaments/t-1/invite-user', { user_id: 'u-1' }, { correlationId: 'c' }],
      ['/tournaments/t-1/invite-group', { group_id: 'g-1' }, { correlationId: 'c' }],
      ['/tournaments/t-1/invite-email', { email: 'a@b.co' }, { correlationId: 'c' }],
      ['/tournaments/t-1/invitations/respond', { accept: true }, { correlationId: 'c' }],
      ['/tournaments/t-1/invitations/respond', { accept: false }, { correlationId: 'c' }],
    ]);
  });
});

describe('group_name and visibility on tournaments', () => {
  const base = {
    id: 't-9', organizer_id: 'org-1', sport: 'football', title: 'Cup', name: null, description: null,
    format: 'knockout', capacity: 8, registration_closes_at: null,
    starts_at: '2999-02-01T00:00:00Z', status: 'upcoming', created_at: '2026-01-01T00:00:00Z',
  };

  it('maps group_name and visibility; null/undefined when absent', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, visibility: 'group', group_name: 'Sunday Footballers' } });
    const t1 = await getTournament('t-9');
    expect(t1).toMatchObject({ group_name: 'Sunday Footballers', visibility: 'group' });
    mockedGet.mockResolvedValueOnce({ data: base });
    const t2 = await getTournament('t-9');
    expect(t2.group_name).toBeNull();
    expect(t2.visibility).toBeUndefined();
  });
});
