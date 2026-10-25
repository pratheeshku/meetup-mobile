/**
 * tournament-registration wire changes (AD-1, AD-4, AD-6, AD-7; brief M1, M4, M7, M8): the register call, the fee and list-row fields, the
 * client config and the media tab flag. HTTP is mocked; nothing here invents a field the backend does not send.
 */
import { normaliseTabs } from '../../utils/tournamentScoring';
import { apiClient } from '../client';
import { getClientConfig } from '../config';
import { getMyTeams } from '../teams';
import { getTournament, getTournaments, registerForTournament } from '../tournaments';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset().mockResolvedValue({ data: {} });
});

describe('registerForTournament (M1)', () => {
  it('a free tournament posts no body', async () => {
    await registerForTournament('t-1', { correlationId: 'c-1' });
    expect(mockedPost).toHaveBeenCalledWith('/tournaments/t-1/registrations', undefined, { correlationId: 'c-1' });
  });

  it('null or an absent fee posts no body; a fee posts only accepted_fee_cents (the server treats an omitted user_id as the caller)', async () => {
    await registerForTournament('t-1', { acceptedFeeCents: null });
    expect(mockedPost.mock.calls[0][1]).toBeUndefined();
    await registerForTournament('t-1', { correlationId: 'c-2', acceptedFeeCents: 1500 });
    expect(mockedPost.mock.calls[1][1]).toEqual({ accepted_fee_cents: 1500 });
    expect(mockedPost.mock.calls[1][2]).toEqual({ correlationId: 'c-2' });
  });
});

describe('registerForTournament, team mode (OI-19)', () => {
  it('sends team_id, with accepted_fee_cents when a fee applies; never user_id', async () => {
    await registerForTournament('t-1', { correlationId: 'c-1', teamId: 'tm-1' });
    expect(mockedPost.mock.calls[0][1]).toEqual({ team_id: 'tm-1' });
    await registerForTournament('t-1', { teamId: 'tm-1', acceptedFeeCents: 4000 });
    expect(mockedPost.mock.calls[1][1]).toEqual({ team_id: 'tm-1', accepted_fee_cents: 4000 });
    expect(mockedPost.mock.calls[1][1]).not.toHaveProperty('user_id');
  });

  it('individual mode with a fee sends only accepted_fee_cents (no team_id, no user_id)', async () => {
    await registerForTournament('t-1', { teamId: null, acceptedFeeCents: 1500 });
    expect(mockedPost.mock.calls[0][1]).toEqual({ accepted_fee_cents: 1500 });
  });
});

describe('getMyTeams', () => {
  it('reads GET /teams/mine and maps the teams', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'tm-1', name: 'Net Ninjas', sport: 'badminton', visibility: 'public', captain_user_id: 'u-1', created_at: 'x', extra: 1 }] });
    const teams = await getMyTeams({ correlationId: 'c-1' });
    expect(mockedGet).toHaveBeenCalledWith('/teams/mine', { correlationId: 'c-1' });
    expect(teams).toEqual([{ id: 'tm-1', name: 'Net Ninjas', sport: 'badminton', visibility: 'public', captain_user_id: 'u-1', created_at: 'x' }]);
  });
});

describe('tournament payload: fee and list-row fields (M4, M8)', () => {
  const base = {
    id: 't-9', organizer_id: 'org-1', sport: 'badminton', title: 'Cup', name: null, description: null,
    format: 'knockout', capacity: 8, registration_closes_at: '2999-01-01T00:00:00Z',
    starts_at: '2999-02-01T00:00:00Z', status: 'upcoming', created_at: '2026-01-01T00:00:00Z',
  };

  it('maps the fee and its currency as sent', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, registration_fee_cents: 1500, registration_fee_currency: 'SGD' } });
    const tournament = await getTournament('t-9');
    expect(tournament.registration_fee_cents).toBe(1500);
    expect(tournament.registration_fee_currency).toBe('SGD');
  });

  it('both null while the server flag is off, and for a payload that does not carry them', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...base, registration_fee_cents: null, registration_fee_currency: null } });
    const off = await getTournament('t-9');
    expect([off.registration_fee_cents, off.registration_fee_currency]).toEqual([null, null]);
    mockedGet.mockResolvedValueOnce({ data: base });
    const missing = await getTournament('t-9');
    expect([missing.registration_fee_cents, missing.registration_fee_currency]).toEqual([null, null]);
  });

  it('maps the venue address and pin and the audience groups of a list row, with no extra request', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{
        ...base,
        visibility: 'group',
        venue_name: 'Bishan Hall',
        venue_address: ' 51 Bishan St 13 ',
        venue_lat: 1.35,
        venue_lng: 103.85,
        venue_place_id: 'pl-1',
        groups: [{ id: 'g-1', name: 'Smashers' }, { id: 'g-2', name: 'Net Ninjas' }, { id: 'bad' }],
        group_ids: ['g-1', 'g-2'],
      }],
    });
    const { items } = await getTournaments();
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(items[0]).toMatchObject({
      venue_address: '51 Bishan St 13',
      venue_lat: 1.35,
      venue_lng: 103.85,
      venue_place_id: 'pl-1',
      audience_groups: [{ id: 'g-1', name: 'Smashers' }, { id: 'g-2', name: 'Net Ninjas' }],
    });
  });

  it('a row without those fields has no groups and no address, never a crash', async () => {
    mockedGet.mockResolvedValueOnce({ data: [base] });
    const { items } = await getTournaments();
    expect(items[0].audience_groups).toEqual([]);
    expect(items[0].venue_address).toBeNull();
    expect(items[0].venue_lat).toBeNull();
  });
});

describe('GET /config/client (M4)', () => {
  it('reads the three fee fields', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { google_maps_api_key: null, venue_catalogue_enabled: true, tournament_fee_enabled: true, tournament_fee_currency: 'SGD', tournament_fee_max_cents: 100000 },
    });
    expect(await getClientConfig()).toMatchObject({
      tournament_fee_enabled: true,
      tournament_fee_currency: 'SGD',
      tournament_fee_max_cents: 100000,
    });
  });

  it('absent fields or a failed call leave the fee control hidden', async () => {
    mockedGet.mockResolvedValueOnce({ data: { venue_catalogue_enabled: true } });
    expect(await getClientConfig()).toMatchObject({ tournament_fee_enabled: false, tournament_fee_currency: null, tournament_fee_max_cents: null });
    mockedGet.mockRejectedValueOnce(new Error('down'));
    expect((await getClientConfig()).tournament_fee_enabled).toBe(false);
  });
});

describe('media tab read_only (M7)', () => {
  it('carries read_only only when the server says true; the tab stays open', () => {
    const tabs = normaliseTabs({ overview: { state: 'open' }, media: { state: 'open', read_only: true } });
    expect(tabs?.media).toEqual({ state: 'open', read_only: true });
    expect(normaliseTabs({ media: { state: 'open' } })?.media).toEqual({ state: 'open' });
    expect(normaliseTabs({ media: { state: 'open', read_only: false } })?.media).toEqual({ state: 'open' });
  });
});
