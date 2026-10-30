/** Tournament team detail clients (tm-m-teams-remarks, DES-MEETUP-ADDENDUM-team-screens-remarks section 4 contract). */
import { apiClient } from '../client';
import {
  getTeam,
  getTeamMembers,
  inviteToTeam,
  removeTeamMember,
  requestToJoinTeam,
  respondToTeamInvite,
  respondToTeamRequest,
  updateTeam,
} from '../teams';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), patch: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const del = apiClient.delete as jest.Mock;
const patch = apiClient.patch as jest.Mock;

const wire = { id: 't-1', name: 'Net Ninjas', sport: 'badminton', visibility: 'public', captain_user_id: 'u-1', created_at: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  [get, post, del, patch].forEach(fn => fn.mockReset());
});

describe('team detail clients', () => {
  it('reads the team and the roster by id', async () => {
    get.mockResolvedValueOnce({ data: wire });
    const team = await getTeam('t-1', { correlationId: 'c-1' });
    expect(get).toHaveBeenLastCalledWith('/teams/t-1', { correlationId: 'c-1' });
    expect(team).toMatchObject({ id: 't-1', player_count: null, my_role: null });

    get.mockResolvedValueOnce({
      data: [{ id: 'm-1', team_id: 't-1', user_id: 'u-1', role: 'captain', status: 'active', created_at: 'x', user_display_name: 'Ravi K.' }],
    });
    const roster = await getTeamMembers('t-1');
    expect(get).toHaveBeenLastCalledWith('/teams/t-1/members', { correlationId: undefined });
    expect(roster[0]).toMatchObject({ user_id: 'u-1', role: 'captain', user_display_name: 'Ravi K.', user_nickname: null });
  });

  it('request, invite and the two responses use the documented routes and query', async () => {
    post.mockResolvedValue({ data: {} });
    await requestToJoinTeam('t-1', { correlationId: 'c' });
    expect(post).toHaveBeenLastCalledWith('/teams/t-1/requests', undefined, { correlationId: 'c' });
    await inviteToTeam('t-1', 'u-9', { correlationId: 'c' });
    expect(post).toHaveBeenLastCalledWith('/teams/t-1/invites', { user_id: 'u-9' }, { correlationId: 'c' });
    await respondToTeamInvite('t-1', true, { correlationId: 'c' });
    expect(post).toHaveBeenLastCalledWith('/teams/t-1/invites/respond', undefined, { params: { accept: true }, correlationId: 'c' });
    await respondToTeamRequest('t-1', 'u-9', false, { correlationId: 'c' });
    expect(post).toHaveBeenLastCalledWith('/teams/t-1/requests/u-9/respond', undefined, { params: { accept: false }, correlationId: 'c' });
  });

  it('remove or leave is a DELETE on the member; replacement_captain_id only when given', async () => {
    del.mockResolvedValue({ data: { status: 'removed' } });
    await removeTeamMember('t-1', 'u-2', { correlationId: 'c' });
    expect(del).toHaveBeenLastCalledWith('/teams/t-1/members/u-2', { params: undefined, correlationId: 'c' });
    await removeTeamMember('t-1', 'u-2', { correlationId: 'c', replacementCaptainId: 'u-3' });
    expect(del).toHaveBeenLastCalledWith('/teams/t-1/members/u-2', { params: { replacement_captain_id: 'u-3' }, correlationId: 'c' });
  });

  it('PATCH sends the given fields only', async () => {
    patch.mockResolvedValueOnce({ data: { ...wire, name: 'Net Ninjas 2' } });
    const team = await updateTeam('t-1', { name: 'Net Ninjas 2' }, { correlationId: 'c' });
    expect(patch).toHaveBeenLastCalledWith('/teams/t-1', { name: 'Net Ninjas 2' }, { correlationId: 'c' });
    expect(team.name).toBe('Net Ninjas 2');
  });
});
