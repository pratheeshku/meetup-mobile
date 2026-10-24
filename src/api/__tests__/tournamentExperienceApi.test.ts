/** te-a1 API: additive tournament fields, banner and logo upload and delete, court booking. */
import { apiClient } from '../client';
import { getCourtBooking } from '../home';
import { deleteTournamentImage, getTournament, getTournamentScoringState, uploadTournamentImage } from '../tournaments';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;
const del = apiClient.delete as jest.Mock;

const RAW = {
  id: 't-1',
  organizer_id: 'o-1',
  sport: 'badminton',
  title: 'Punggol Open 2026',
  description: null,
  format: 'group_stage',
  capacity: 32,
  registration_closes_at: '2026-10-30T15:59:00Z',
  starts_at: '2026-11-14T01:00:00Z',
  ends_at: '2026-11-15T10:00:00Z',
  status: 'upcoming',
  created_at: '2026-10-14T00:00:00Z',
  participation_mode: 'individual',
  schedule_published_at: null,
  banner_url: 'https://cdn.example/b.jpg',
  logo_url: 'https://cdn.example/l.jpg',
  banner_tone: 'dark',
  banner_scrim: 25,
  has_custom_banner: true,
  organizer: { user_id: 'o-1', display_name: 'Ravi K.', nickname: 'Ravi', avatar_url: null },
  committee: [{ user_id: 'c-1', display_name: 'Alicia Lim', nickname: 'Ally', avatar_url: 'https://cdn.example/a.jpg' }],
};

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  del.mockReset();
});

describe('tournament read: additive fields', () => {
  it('carries banner, logo, tone, scrim, organizer and committee as the server sent them', async () => {
    get.mockResolvedValueOnce({ data: RAW });
    const t = await getTournament('t-1');
    expect(t).toMatchObject({
      banner_url: 'https://cdn.example/b.jpg',
      logo_url: 'https://cdn.example/l.jpg',
      banner_tone: 'dark',
      banner_scrim: 25,
      has_custom_banner: true,
      participation_mode: 'individual',
      ends_at: '2026-11-15T10:00:00Z',
      organizer: { display_name: 'Ravi K.', nickname: 'Ravi' },
    });
    expect(t.committee).toHaveLength(1);
    expect(t.committee?.[0].display_name).toBe('Alicia Lim');
  });

  it('a server without the fields (an older list answer) leaves them empty, never invented', async () => {
    const older: Record<string, unknown> = { ...RAW };
    ['banner_url', 'logo_url', 'banner_tone', 'banner_scrim', 'has_custom_banner', 'organizer', 'committee'].forEach(key => delete older[key]);
    get.mockResolvedValueOnce({ data: older });
    const t = await getTournament('t-1');
    expect(t).toMatchObject({ banner_url: null, logo_url: null, banner_tone: null, banner_scrim: null, has_custom_banner: false, organizer: null, committee: [] });
  });

  it('an unknown tone is dropped rather than shown', async () => {
    get.mockResolvedValueOnce({ data: { ...RAW, banner_tone: 'rainbow' } });
    expect((await getTournament('t-1')).banner_tone).toBeNull();
  });
});

describe('scoring state: tabs', () => {
  it('reads the server tabs object and the poll interval', async () => {
    get.mockResolvedValueOnce({
      data: {
        enabled: true,
        applicable: true,
        registration_phase: 'open',
        fixtures_published: false,
        any_result_posted: false,
        tabs: { overview: { state: 'open' }, fixtures: { state: 'locked', unlocks: 'fixtures_published' }, approvals: { state: 'open', badge: 2 } },
        live_poll_seconds: 10,
      },
    });
    const state = await getTournamentScoringState('t-1');
    expect(get).toHaveBeenCalledWith('/tournaments/t-1/scoring/state', { correlationId: undefined });
    expect(state?.tabs?.fixtures).toEqual({ state: 'locked', unlocks: 'fixtures_published' });
    expect(state?.tabs?.approvals).toEqual({ state: 'open', badge: 2 });
    expect(state?.live_poll_seconds).toBe(10);
  });

  it('a version 1 answer has no tabs', async () => {
    get.mockResolvedValueOnce({ data: { enabled: false, applicable: false } });
    expect((await getTournamentScoringState('t-1'))?.tabs).toBeUndefined();
  });
});

describe('banner and logo', () => {
  const file = { uri: 'file:///tmp/b.jpg', name: 'b.jpg', type: 'image/jpeg' };
  const images = { banner_url: 'https://cdn.example/new.jpg', logo_url: null, banner_tone: 'light', banner_scrim: 40, has_custom_banner: true };

  it.each(['banner', 'logo'] as const)('PUT /tournaments/{id}/%s sends one multipart field "file" with the correlation id', async kind => {
    put.mockResolvedValueOnce({ data: images });
    const out = await uploadTournamentImage('t-1', kind, file, { correlationId: 'c-1' });
    expect(out).toEqual(images);
    const [url, form, config] = put.mock.calls[0];
    expect(url).toBe(`/tournaments/t-1/${kind}`);
    expect(config).toEqual({ correlationId: 'c-1', headers: { 'Content-Type': 'multipart/form-data' } });
    expect(form).toBeInstanceOf(FormData);
    expect(Array.from((form as unknown as { keys(): Iterable<string> }).keys())).toEqual(['file']);
  });

  it.each(['banner', 'logo'] as const)('DELETE /tournaments/{id}/%s restores the default', async kind => {
    del.mockResolvedValueOnce({ data: { ...images, has_custom_banner: false } });
    const out = await deleteTournamentImage('t-1', kind, { correlationId: 'c-2' });
    expect(del).toHaveBeenCalledWith(`/tournaments/t-1/${kind}`, { correlationId: 'c-2' });
    expect(out.has_custom_banner).toBe(false);
  });

  it('a rejection (IMAGE_INVALID) propagates with its body', async () => {
    put.mockRejectedValueOnce({ response: { status: 422, data: { detail: { code: 'IMAGE_INVALID', reason: 'TYPE' } } } });
    await expect(uploadTournamentImage('t-1', 'banner', file)).rejects.toMatchObject({ response: { status: 422 } });
  });
});

describe('GET /home/court-booking', () => {
  it('returns the providers in the server order and drops any without an https link', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'p1', name: 'CourtHub', description: 'Courts', booking_url: 'https://courthub.example/book', logo_url: null },
          { id: 'p2', name: 'Bad', description: null, booking_url: 'http://insecure.example', logo_url: null },
          { id: 'p3', name: 'PlayBay', description: null, booking_url: 'https://playbay.example', logo_url: 'https://cdn.example/p.png' },
        ],
      },
    });
    const items = await getCourtBooking({ correlationId: 'c-3' });
    expect(get).toHaveBeenCalledWith('/home/court-booking', { correlationId: 'c-3' });
    expect(items.map(item => item.id)).toEqual(['p1', 'p3']);
  });

  it('an empty or malformed answer is an empty list', async () => {
    get.mockResolvedValueOnce({ data: { items: [] } });
    expect(await getCourtBooking()).toEqual([]);
    get.mockResolvedValueOnce({ data: {} });
    expect(await getCourtBooking()).toEqual([]);
  });
});
