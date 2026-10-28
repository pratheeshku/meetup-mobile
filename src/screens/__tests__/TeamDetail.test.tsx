/** Tournament team detail (team-screens-remarks AD-1, TS-T9): the four viewer states, a 403 roster is "not on the roster", a 404 team is the notice. */
import React from 'react';

import { renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import TeamDetailScreen from '../TeamDetailScreen';

type Props = React.ComponentProps<typeof TeamDetailScreen>;

const mockGetTeam = jest.fn();
const mockGetMembers = jest.fn();
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', nickname: 'me' } }) }));
jest.mock('../../api/teams', () => ({
  getTeam: (...a: unknown[]) => mockGetTeam(...a),
  getTeamMembers: (...a: unknown[]) => mockGetMembers(...a),
}));

const TEAM = { id: 'tm-1', name: 'Net Ninjas', sport: 'badminton', visibility: 'public', captain_user_id: 'cap', created_at: 'x' };
const row = (user_id: string, status: string, role = 'member', name = user_id) => ({
  id: `m-${user_id}`, team_id: 'tm-1', user_id, role, status, created_at: 'x', user_display_name: name, user_nickname: null,
});
const refusal = (status: number) => Object.assign(new Error('x'), { response: { status, data: { detail: 'server text' } } });

const mount = (): Promise<Instance> =>
  renderAsync(<TeamDetailScreen {...({ navigation: { goBack: jest.fn() }, route: { params: { teamId: 'tm-1' } } } as unknown as Props)} />);

beforeEach(() => {
  mockGetTeam.mockReset().mockResolvedValue(TEAM);
  mockGetMembers.mockReset().mockResolvedValue([]);
});

describe('viewer states', () => {
  it('active: header, the team players with the Captain badge', async () => {
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain', 'Ravi K.'), row('me', 'active', 'member', 'Me Myself'), row('x', 'requested')]);
    const all = texts(await mount());
    expect(all).toEqual(expect.arrayContaining(['Net Ninjas', 'Open to join requests', 'Team players', 'Ravi K.', 'Me Myself', 'Captain']));
    expect(all).not.toContain('Join request pending');
  });

  it('invited: the invitation banner', async () => {
    mockGetTeam.mockResolvedValue({ ...TEAM, visibility: 'private' });
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain'), row('me', 'invited')]);
    const all = texts(await mount());
    expect(all).toContain('You were invited to join this tournament team');
    expect(all).toContain('Invite only');
  });

  it('requested: Join request pending', async () => {
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain'), row('me', 'requested')]);
    expect(texts(await mount())).toContain('Join request pending');
  });

  it('a 403 from the roster route means not on the roster: the header shows, no players section, no error', async () => {
    mockGetMembers.mockRejectedValue(refusal(403));
    const all = texts(await mount());
    expect(all).toContain('Net Ninjas');
    expect(all).not.toContain('Team players');
    expect(all).not.toContain('That did not work. Please try again.');
  });
});

describe('read failures', () => {
  it('a 404 from the team route shows the not-available notice, never the server text', async () => {
    mockGetTeam.mockRejectedValue(refusal(404));
    const all = texts(await mount());
    expect(all).toContain('This tournament team is not available.');
    expect(all).not.toContain('server text');
    expect(mockGetMembers).not.toHaveBeenCalled();
  });

  it('another failure shows a retry state, not a stale detail', async () => {
    mockGetTeam.mockRejectedValue(refusal(500));
    const all = texts(await mount());
    expect(all).toContain('That did not work. Please try again.');
    expect(all).not.toContain('Net Ninjas');
  });

  it('a non-403 roster failure is a failed read, not a half detail', async () => {
    mockGetMembers.mockRejectedValue(refusal(500));
    const all = texts(await mount());
    expect(all).toContain('That did not work. Please try again.');
    expect(all).not.toContain('Net Ninjas');
  });
});
