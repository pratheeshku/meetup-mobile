/**
 * `GET /api/labels` — the endpoint nests the flat label map under a
 * `labels` key (verified live 2026-09-25, see `src/api/labels.ts`'s header
 * comment); this test locks in the unwrap so a future regression back to
 * treating the raw body as the map is caught immediately.
 */
import { apiClient } from '../client';
import { getLabels } from '../labels';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getLabels', () => {
  it('calls the labels endpoint and unwraps response.labels', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        labels: {
          'skill_level.beginner': 'Beginner',
          'event_visibility.public': 'Public',
          'team_visibility.private': 'Private',
        },
      },
    });

    const labels = await getLabels({ correlationId: 'cid' });

    expect(mockedGet).toHaveBeenCalledWith('/api/labels', { correlationId: 'cid' });
    expect(labels).toEqual({
      'skill_level.beginner': 'Beginner',
      'event_visibility.public': 'Public',
      'team_visibility.private': 'Private',
    });
  });

  it('does not return the raw response body as the map (the endpoint nests under `labels`)', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { labels: { 'skill_level.beginner': 'Beginner' } },
    });

    const labels = await getLabels();

    expect(labels).not.toHaveProperty('labels');
    expect(labels).toEqual({ 'skill_level.beginner': 'Beginner' });
  });
});
