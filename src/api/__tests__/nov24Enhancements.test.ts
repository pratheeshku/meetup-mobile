/**
 * API contracts of DES-MEETUP-ADDENDUM-nov24-enhancements (data contracts section):
 * - NV-01 `GET /venues/saved?q=`, `DELETE /venues/saved/{id}`, `saved_venue_id` on create and edit.
 * - NV-03 `PUT` / `DELETE /events/{id}/banner` and `banner_url` on game reads.
 */
import { apiClient } from '../client';
import { createEvent, deleteEventBanner, getEvent, updateEvent, uploadEventBanner } from '../events';
import { deleteSavedVenue, getSavedVenues } from '../venues';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mocked = apiClient as unknown as Record<'get' | 'patch' | 'post' | 'put' | 'delete', jest.Mock>;

const rawEvent = (extra: Record<string, unknown> = {}) => ({
  id: 'evt-1',
  organizer_id: 'org-1',
  sport: 'badminton',
  title: 'Doubles',
  description: null,
  visibility: 'public',
  capacity: 8,
  starts_at: '2026-12-01T10:00:00Z',
  ends_at: '2026-12-01T12:00:00Z',
  estimated_cost_cents: null,
  recurrence_rule_id: null,
  status: 'upcoming',
  going_count: 1,
  ...extra,
});

beforeEach(() => {
  Object.values(mocked).forEach(fn => fn.mockReset());
});

describe('saved venues (NV-01)', () => {
  it('GET /venues/saved with the search text, returning the items', async () => {
    mocked.get.mockResolvedValueOnce({ data: { items: [{ id: 'sv-1', name: 'Condo Court' }] } });

    await expect(getSavedVenues('  condo ', { correlationId: 'cid' })).resolves.toEqual([{ id: 'sv-1', name: 'Condo Court' }]);
    expect(mocked.get).toHaveBeenCalledWith('/venues/saved', { params: { q: 'condo' }, correlationId: 'cid' });
  });

  it('sends no q when the search is blank, and caps q at 100 characters', async () => {
    mocked.get.mockResolvedValue({ data: { items: [] } });

    await getSavedVenues('   ');
    expect(mocked.get).toHaveBeenLastCalledWith('/venues/saved', { params: { q: undefined }, correlationId: undefined });

    await getSavedVenues('x'.repeat(150));
    expect(mocked.get.mock.calls[1][1].params.q).toHaveLength(100);
  });

  it('a body without items is an empty list', async () => {
    mocked.get.mockResolvedValueOnce({ data: {} });
    await expect(getSavedVenues()).resolves.toEqual([]);
  });

  it('DELETE /venues/saved/{id}', async () => {
    mocked.delete.mockResolvedValueOnce({ status: 204 });
    await deleteSavedVenue('sv-1', { correlationId: 'cid' });
    expect(mocked.delete).toHaveBeenCalledWith('/venues/saved/sv-1', { correlationId: 'cid' });
  });

  it('createEvent sends saved_venue_id as given', async () => {
    mocked.post.mockResolvedValueOnce({ data: rawEvent() });
    await createEvent({
      title: 'Doubles',
      sport: 'badminton',
      visibility: 'public',
      capacity: 8,
      starts_at: '2026-12-01T10:00:00Z',
      ends_at: '2026-12-01T12:00:00Z',
      skill_level_requirement: 'all_levels',
      saved_venue_id: 'sv-1',
    });
    expect(mocked.post.mock.calls[0][1]).toMatchObject({ saved_venue_id: 'sv-1' });
    expect(mocked.post.mock.calls[0][1]).not.toHaveProperty('venue_id');
    expect(mocked.post.mock.calls[0][1]).not.toHaveProperty('others');
  });

  it('updateEvent passes saved_venue_id through, and omits it when not given', async () => {
    mocked.patch.mockResolvedValue({ data: rawEvent() });
    await updateEvent('evt-1', { saved_venue_id: 'sv-2' });
    expect(mocked.patch.mock.calls[0][1]).toEqual({ saved_venue_id: 'sv-2' });

    await updateEvent('evt-1', { title: 'x' });
    expect(mocked.patch.mock.calls[1][1]).not.toHaveProperty('saved_venue_id');
  });
});

describe('game banner (NV-03)', () => {
  it('PUT /events/{id}/banner as multipart with one field named file', async () => {
    mocked.put.mockResolvedValueOnce({ data: { banner_url: 'https://cdn.example/b.jpg' } });

    await expect(
      uploadEventBanner('evt-1', { uri: 'file:///b.jpg', name: 'b.jpg', type: 'image/jpeg' }, { correlationId: 'cid' }),
    ).resolves.toEqual({ banner_url: 'https://cdn.example/b.jpg' });

    const [url, body, config] = mocked.put.mock.calls[0];
    expect(url).toBe('/events/evt-1/banner');
    expect(body).toBeInstanceOf(FormData);
    expect(config).toEqual({ correlationId: 'cid', headers: { 'Content-Type': 'multipart/form-data' } });
  });

  it('a refusal rejects with the axios error (IMAGE_INVALID, 413)', async () => {
    const refusal = Object.assign(new Error('413'), { response: { status: 413 } });
    mocked.put.mockRejectedValueOnce(refusal);
    await expect(uploadEventBanner('evt-1', { uri: 'u', name: 'n', type: 'image/png' })).rejects.toBe(refusal);
  });

  it('DELETE /events/{id}/banner', async () => {
    mocked.delete.mockResolvedValueOnce({ data: { banner_url: null } });
    await expect(deleteEventBanner('evt-1', { correlationId: 'cid' })).resolves.toEqual({ banner_url: null });
    expect(mocked.delete).toHaveBeenCalledWith('/events/evt-1/banner', { correlationId: 'cid' });
  });

  it.each([
    ['a URL', 'https://cdn.example/b.jpg', 'https://cdn.example/b.jpg'],
    ['null', null, null],
    ['absent (older server)', undefined, null],
    ['an empty string', '', null],
  ])('game reads map banner_url: %s', async (_label, value, expected) => {
    mocked.get.mockResolvedValueOnce({ data: rawEvent(value === undefined ? {} : { banner_url: value }) });
    expect((await getEvent('evt-1')).banner_url).toBe(expected);
  });
});
