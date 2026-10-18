/** Access consistency AC-10: group rows are never cached on the device or served after a failed call. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient } from '../client';
import { getGroups } from '../groups';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
  (AsyncStorage.getItem as jest.Mock | undefined)?.mockReset?.();
});

describe('getGroups', () => {
  // The first call in a session also removes the entry an older app version left on the device.
  it('does not write the rows to AsyncStorage, and removes the legacy cache entry', async () => {
    const removeItem = jest.spyOn(AsyncStorage, 'removeItem');
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    mockGet.mockResolvedValueOnce({ data: [{ id: 'g1', name: 'Alpha', created_at: '2026-01-01T00:00:00Z' }] });
    const result = await getGroups({ mine: true, limit: 3 });
    expect(result.items.map(g => g.name)).toEqual(['Alpha']);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith('@meetup/home_groups_cache');
    setItem.mockRestore();
    removeItem.mockRestore();
  });

  it('rejects when the call fails instead of returning rows saved earlier', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(
      JSON.stringify({ savedAt: Date.now(), data: [{ id: 'old', name: 'Old group' }] }),
    );
    mockGet.mockRejectedValueOnce(new Error('offline'));
    await expect(getGroups({ mine: true })).rejects.toThrow('offline');
    expect(getItem).not.toHaveBeenCalledWith('@meetup/home_groups_cache');
    getItem.mockRestore();
  });
});
