/**
 * Regression test for the full-contract-audit fix to
 * `api/notifications.ts` (docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md),
 * using a fixture built from the real backend's confirmed
 * `NotificationPreferencesResponse` OpenAPI schema.
 */
import { apiClient } from '../client';
import {
  getNotificationHistory,
  getPreferences,
  getUnreadCount,
  markNotificationRead,
} from '../notifications';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
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

describe('getNotificationHistory', () => {
  const page = {
    items: [
      {
        id: 'b3f1c0de-0000-4000-8000-000000000001',
        notification_type: 'event_changed',
        title: null,
        body: null,
        entity_id: null,
        entity_type: null,
        created_at: '2026-09-21T10:00:00Z',
        read_at: null,
      },
    ],
    next_cursor: null,
  };

  it('GETs /notifications/history with no cursor param on the first page', async () => {
    mockedGet.mockResolvedValueOnce({ data: page });

    const result = await getNotificationHistory();

    expect(mockedGet).toHaveBeenCalledWith('/notifications/history', { params: undefined });
    expect(result).toEqual(page);
  });

  it('passes the cursor as a query param for later pages', async () => {
    mockedGet.mockResolvedValueOnce({ data: { items: [] } });

    await getNotificationHistory('2026-09-20T08:30:00+00:00');

    expect(mockedGet).toHaveBeenCalledWith('/notifications/history', {
      params: { cursor: '2026-09-20T08:30:00+00:00' },
    });
  });
});

describe('markNotificationRead', () => {
  it('POSTs /notifications/{id}/read', async () => {
    mockedPost.mockResolvedValueOnce({ status: 204 });

    await expect(markNotificationRead('abc-123')).resolves.toBeUndefined();

    expect(mockedPost).toHaveBeenCalledWith('/notifications/abc-123/read');
  });
});

describe('getUnreadCount', () => {
  it('GETs /notifications/unread-count and returns { count }', async () => {
    mockedGet.mockResolvedValueOnce({ data: { count: 4 } });

    const result = await getUnreadCount();

    expect(mockedGet).toHaveBeenCalledWith('/notifications/unread-count');
    expect(result).toEqual({ count: 4 });
  });
});
