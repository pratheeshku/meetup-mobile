/** Tournament team detail (team-screens-remarks AD-1, TS-T9): the four viewer states, a 403 roster is "not on the roster", a 404 team is the notice. */
import React from 'react';

import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import TeamDetailScreen from '../TeamDetailScreen';

type Props = React.ComponentProps<typeof TeamDetailScreen>;

const mockGetTeam = jest.fn();
const mockGetMembers = jest.fn();
const mockRequest = jest.fn();
const mockRespondInvite = jest.fn();
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', nickname: 'me' } }) }));
jest.mock('../../api/teams', () => ({
  getTeam: (...a: unknown[]) => mockGetTeam(...a),
  getTeamMembers: (...a: unknown[]) => mockGetMembers(...a),
  requestToJoinTeam: (...a: unknown[]) => mockRequest(...a),
  respondToTeamInvite: (...a: unknown[]) => mockRespondInvite(...a),
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
  mockRequest.mockReset().mockResolvedValue(undefined);
  mockRespondInvite.mockReset().mockResolvedValue(undefined);
});

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function');
/** A Button renders two nested nodes that carry the same testID and handler; "shown" means at least one. */
const shown = (root: Instance, id: string): boolean => byId(root, id).length > 0;
const tap = async (root: Instance, id: string): Promise<void> => {
  await act(async () => {
    byId(root, id)[0].props.onPress();
  });
};

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

describe('Request to join (TS-04)', () => {
  it('a non-member of a public team sees Request to join; sending it moves the screen to Join request pending', async () => {
    mockGetMembers.mockRejectedValueOnce(refusal(403));
    const root = await mount();
    expect(shown(root, 'team-request-join')).toBe(true);
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain'), row('me', 'requested')]);
    await tap(root, 'team-request-join');
    expect(mockRequest).toHaveBeenCalledWith('tm-1', expect.objectContaining({ correlationId: expect.any(String) }));
    const all = texts(root);
    expect(all).toContain('Join request pending');
    expect(all).toContain('Join request sent');
    expect(shown(root, 'team-request-join')).toBe(false);
  });

  it('a private team shows no Request to join', async () => {
    mockGetTeam.mockResolvedValue({ ...TEAM, visibility: 'private' });
    mockGetMembers.mockRejectedValue(refusal(403));
    expect(shown(await mount(), 'team-request-join')).toBe(false);
  });

  it('a refusal keeps the screen as it was and shows a label, never the server text', async () => {
    mockGetMembers.mockRejectedValue(refusal(403));
    mockRequest.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { detail: 'User already has a membership record' } } }));
    const root = await mount();
    await tap(root, 'team-request-join');
    const all = texts(root);
    expect(all).toContain('That did not work. Please try again.');
    expect(all).not.toContain('User already has a membership record');
    expect(shown(root, 'team-request-join')).toBe(true);
  });
});

describe('Invitation response (TS-05)', () => {
  beforeEach(() => {
    mockGetTeam.mockResolvedValue({ ...TEAM, visibility: 'private' });
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain'), row('me', 'invited')]);
  });

  it('the invited viewer sees Accept and Decline; Accept calls the respond route with accept=true and shows the team players view', async () => {
    const root = await mount();
    expect(shown(root, 'team-accept')).toBe(true);
    expect(shown(root, 'team-decline')).toBe(true);
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain'), row('me', 'active')]);
    await tap(root, 'team-accept');
    expect(mockRespondInvite).toHaveBeenCalledWith('tm-1', true, expect.objectContaining({ correlationId: expect.any(String) }));
    expect(shown(root, 'team-accept')).toBe(false);
  });

  it('Decline sends accept=false; a private team the caller can no longer see shows the not-available notice', async () => {
    const root = await mount();
    mockGetTeam.mockRejectedValue(refusal(404));
    await tap(root, 'team-decline');
    expect(mockRespondInvite).toHaveBeenCalledWith('tm-1', false, expect.objectContaining({ correlationId: expect.any(String) }));
    expect(texts(root)).toContain('This tournament team is not available.');
  });
});
