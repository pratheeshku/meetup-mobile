/** Invite reminder (v1.0.2): the two POST routes. */
import { apiClient } from '../client';
import { remindEventInvitee } from '../events';
import { remindTournamentInvitee } from '../tournaments';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockedPost = apiClient.post as jest.Mock;
const ack = { sent_at: '2026-11-20T05:00:00Z', last_reminded_at: '2026-11-20T05:00:00Z', reminder_count: 1 };

afterEach(() => mockedPost.mockReset());

describe('reminder routes', () => {
  it('remindEventInvitee posts {user_id} to /events/{id}/reminders with the correlation id', async () => {
    mockedPost.mockResolvedValueOnce({ data: ack });
    await expect(remindEventInvitee('evt-1', 'user-9', { correlationId: 'c-1' })).resolves.toEqual(ack);
    expect(mockedPost).toHaveBeenCalledWith('/events/evt-1/reminders', { user_id: 'user-9' }, { correlationId: 'c-1' });
  });

  it('remindTournamentInvitee posts {user_id} to /tournaments/{id}/reminders', async () => {
    mockedPost.mockResolvedValueOnce({ data: ack });
    await expect(remindTournamentInvitee('t-1', 'user-9', { correlationId: 'c-2' })).resolves.toEqual(ack);
    expect(mockedPost).toHaveBeenCalledWith('/tournaments/t-1/reminders', { user_id: 'user-9' }, { correlationId: 'c-2' });
  });

  it('lets the HTTP error through for the caller to read', async () => {
    const failure = { response: { status: 409, data: { code: 'REMINDER_LIMIT' } } };
    mockedPost.mockRejectedValueOnce(failure);
    await expect(remindEventInvitee('evt-1', 'user-9')).rejects.toBe(failure);
  });
});
