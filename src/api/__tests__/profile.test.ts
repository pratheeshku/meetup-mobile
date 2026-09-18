/**
 * Regression tests for the full-contract-audit fixes to `api/profile.ts`
 * (docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), using a fixture
 * built from the real backend's confirmed `PrivateUserProfile` OpenAPI
 * schema.
 */
import { apiClient } from '../client';
import { getProfile } from '../profile';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getProfile', () => {
  it('maps PrivateUserProfile and merges in GET /users/me/skill-levels', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'u-1',
            display_name: 'Pat H',
            nickname: 'pat',
            avatar_storage_key: 'avatars/u-1.png',
            theme_preference: 'system',
            created_at: '2026-01-01T00:00:00Z',
            email: 'pat@example.com',
            is_admin: false,
            tournament_participation_history: null,
          },
        });
      }
      if (url === '/users/me/skill-levels') {
        return Promise.resolve({ data: [{ sport: 'football', skill_level: 'Intermediate' }] });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await getProfile();

    expect(result).toMatchObject({
      id: 'u-1',
      email: 'pat@example.com',
      nickname: 'pat',
      display_name: 'Pat H',
      is_admin: false,
      skill_levels: [{ sport: 'football', skill_level: 'Intermediate' }],
    });
    // BLOCKED fields (no source on the real response) must stay unset,
    // never a guessed value.
    expect(result.avatar_url).toBeNull();
    expect(result.role).toBeUndefined();
  });

  it('degrades to an empty skill_levels list if the secondary endpoint fails', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'u-1',
            display_name: 'Pat H',
            nickname: 'pat',
            avatar_storage_key: null,
            theme_preference: 'system',
            created_at: '2026-01-01T00:00:00Z',
            email: 'pat@example.com',
            is_admin: false,
            tournament_participation_history: null,
          },
        });
      }
      if (url === '/users/me/skill-levels') {
        return Promise.reject(new Error('unexpected shape'));
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await getProfile();
    expect(result.skill_levels).toEqual([]);
  });
});
