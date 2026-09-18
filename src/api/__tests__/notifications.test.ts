/**
 * Regression test for the full-contract-audit fix to
 * `api/notifications.ts` (docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md),
 * using a fixture built from the real backend's confirmed
 * `NotificationPreferencesResponse` OpenAPI schema.
 */
import { apiClient } from '../client';
import { getPreferences } from '../notifications';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getPreferences', () => {
  it('unwraps the { preferences: [...] } envelope into a bare array', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        preferences: [
          { notification_type: 'global', enabled: true },
          { notification_type: 'event_invite', enabled: false },
        ],
      },
    });

    const result = await getPreferences();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      { notification_type: 'global', enabled: true },
      { notification_type: 'event_invite', enabled: false },
    ]);
  });
});
