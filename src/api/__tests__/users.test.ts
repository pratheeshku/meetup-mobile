/** `GET /users/search`, fixture shaped like the live `UserSearchResult`. */
import { apiClient } from '../client';
import { searchUsers } from '../users';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('searchUsers', () => {
  it('calls /users/search with q and maps the response to id/display_name/nickname/pending', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 'u-1',
          display_name: 'Sam Smith',
          nickname: 'sam99',
          avatar_storage_key: null,
          theme_preference: 'system',
          created_at: '2026-01-01T00:00:00Z',
          pending: false,
        },
      ],
    });

    const results = await searchUsers({ q: 'sam' }, { correlationId: 'cid' });

    expect(mockedGet).toHaveBeenCalledWith('/users/search', {
      params: {
        q: 'sam',
        exclude_group_id: undefined,
        exclude_event_id: undefined,
        exclude_team_id: undefined,
      },
      correlationId: 'cid',
    });
    expect(results).toEqual([
      { id: 'u-1', display_name: 'Sam Smith', nickname: 'sam99', pending: false },
    ]);
  });

  it('passes exclude_group_id through when supplied, leaving the other excludes undefined', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });

    await searchUsers({ q: 'sam', excludeGroupId: 'group-1' });

    expect(mockedGet).toHaveBeenCalledWith('/users/search', {
      params: {
        q: 'sam',
        exclude_group_id: 'group-1',
        exclude_event_id: undefined,
        exclude_team_id: undefined,
      },
      correlationId: undefined,
    });
  });
});
