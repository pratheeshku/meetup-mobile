/** User details menu API calls: card endpoints and the organiser remove-player call. */
import { apiClient } from '../client';
import { getEventPlayerCard, removeEventParticipant } from '../events';
import { getGroupMemberCard } from '../groups';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), delete: jest.fn() } }));

const mockGet = apiClient.get as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({ data: { user_id: 'u-1' } });
  mockDelete.mockReset().mockResolvedValue({ data: { id: 'p-1', user_id: 'u-1', status: 'withdrawn' } });
});

it('getGroupMemberCard: GET /groups/{group}/members/{user}/card with the correlation id and timeout', async () => {
  await getGroupMemberCard('g-1', 'u-1', { correlationId: 'c-1', timeoutMs: 8000 });
  expect(mockGet).toHaveBeenCalledWith('/groups/g-1/members/u-1/card', { correlationId: 'c-1', timeout: 8000 });
});

it('getEventPlayerCard: GET /events/{event}/players/{user}/card', async () => {
  await getEventPlayerCard('e-1', 'u-1', { correlationId: 'c-1' });
  expect(mockGet).toHaveBeenCalledWith('/events/e-1/players/u-1/card', { correlationId: 'c-1', timeout: undefined });
});

it('removeEventParticipant: DELETE /events/{event}/participants/{user}, reason only when given', async () => {
  await removeEventParticipant('e-1', 'u-1', { correlationId: 'c-1' });
  expect(mockDelete).toHaveBeenLastCalledWith('/events/e-1/participants/u-1', { correlationId: 'c-1', params: undefined });
  await removeEventParticipant('e-1', 'u-1', { correlationId: 'c-1', reason: 'No show' });
  expect(mockDelete).toHaveBeenLastCalledWith('/events/e-1/participants/u-1', { correlationId: 'c-1', params: { reason: 'No show' } });
});
