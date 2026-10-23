import { apiClient } from '../client';
import { getCommitteeInvitation, getCommitteeMembers, getTournament, respondToCommitteeInvitation } from '../tournaments';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const wire = {
  id: 't-1', organizer_id: 'o-1', sport: 'badminton', title: 'Punggol Open 2026', name: null, description: null,
  format: 'group_stage', capacity: 32, registration_closes_at: '2999-01-01T00:00:00Z', starts_at: '2999-02-01T00:00:00Z',
  status: 'upcoming', created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('GET /tournaments/{id}: my_committee_invitation', () => {
  it.each([
    ['pending', 'pending'],
    [null, null],
    [undefined, null],
    ['active', null],
    ['something-new', null],
  ])('%s reads as %s', async (value, expected) => {
    get.mockResolvedValueOnce({ data: { ...wire, my_committee_invitation: value } });
    expect((await getTournament('t-1')).my_committee_invitation).toBe(expected);
  });
});

describe('committee invitation calls', () => {
  it('accept and decline POST with no body and the correlation id', async () => {
    post.mockResolvedValue({ data: { tournament_id: 't-1', status: 'active' } });
    expect(await respondToCommitteeInvitation('t-1', true, { correlationId: 'c-1' })).toEqual({ tournament_id: 't-1', status: 'active' });
    expect(post).toHaveBeenLastCalledWith('/tournaments/t-1/committee/invitation/accept', undefined, { correlationId: 'c-1' });
    await respondToCommitteeInvitation('t-1', false, { correlationId: 'c-2' });
    expect(post).toHaveBeenLastCalledWith('/tournaments/t-1/committee/invitation/decline', undefined, { correlationId: 'c-2' });
  });

  it('reads the card summary and the member names', async () => {
    get.mockResolvedValueOnce({ data: { tournament_id: 't-1', status: 'pending', title: 'Punggol Open 2026', sport: 'badminton', starts_at: 'a', ends_at: 'b', organizer_name: 'Ravi K.' } });
    expect((await getCommitteeInvitation('t-1')).organizer_name).toBe('Ravi K.');
    expect(get).toHaveBeenLastCalledWith('/tournaments/t-1/committee/invitation', { correlationId: undefined });
    get.mockResolvedValueOnce({ data: [{ user_id: 'u', display_name: 'Ravi K.', status: 'active', is_organizer: true }] });
    expect((await getCommitteeMembers('t-1'))[0].display_name).toBe('Ravi K.');
    get.mockResolvedValueOnce({ data: null });
    expect(await getCommitteeMembers('t-1')).toEqual([]);
  });
});
