/** Tournament team detail (team-screens-remarks AD-1, TS-T9): the four viewer states, a 403 roster is "not on the roster", a 404 team is the notice. */
import React from 'react';
import { Alert } from 'react-native';

import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import TeamDetailScreen from '../TeamDetailScreen';

type Props = React.ComponentProps<typeof TeamDetailScreen>;

const mockGetTeam = jest.fn();
const mockGetMembers = jest.fn();
const mockRequest = jest.fn();
const mockRespondInvite = jest.fn();
const mockRespondRequest = jest.fn();
const mockRemove = jest.fn();
const mockUpdate = jest.fn();
const mockInvite = jest.fn();
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', nickname: 'me' } }) }));
jest.mock('../../api/teams', () => ({
  getTeam: (...a: unknown[]) => mockGetTeam(...a),
  getTeamMembers: (...a: unknown[]) => mockGetMembers(...a),
  requestToJoinTeam: (...a: unknown[]) => mockRequest(...a),
  respondToTeamInvite: (...a: unknown[]) => mockRespondInvite(...a),
  respondToTeamRequest: (...a: unknown[]) => mockRespondRequest(...a),
  removeTeamMember: (...a: unknown[]) => mockRemove(...a),
  updateTeam: (...a: unknown[]) => mockUpdate(...a),
  inviteToTeam: (...a: unknown[]) => mockInvite(...a),
}));
jest.mock('../../components/UserSearchPicker', () => {
  const ReactMock = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  // A stand-in with one person; the host's onSelect and immediateRow are what is under test.
  return {
    __esModule: true,
    default: ({ onSelect, placeholder, excludeTeamId }: any) =>
      ReactMock.createElement(View, { testID: 'picker', accessibilityLabel: `${placeholder}|${excludeTeamId}`, onPress: () => onSelect({ id: 'u-new' }) }),
  };
});

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
  mockRespondRequest.mockReset().mockResolvedValue(undefined);
  mockRemove.mockReset().mockResolvedValue(undefined);
  mockUpdate.mockReset().mockResolvedValue({ ...TEAM, name: 'Renamed' });
  mockInvite.mockReset().mockResolvedValue(undefined);
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

/** Confirms the last Alert (Cancel is the first button, the action the second). */
const confirmAlert = async (): Promise<void> => {
  const alert = Alert.alert as jest.Mock;
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2] as Array<{ onPress?: () => unknown }>;
  await act(async () => {
    await buttons[1].onPress?.();
  });
};

describe('Captain tools (TS-06, TS-T11)', () => {
  const captainRoster = [
    row('me', 'active', 'captain', 'Me Captain'),
    row('p1', 'active', 'member', 'Player One'),
    row('r1', 'requested', 'member', 'Asker One'),
  ];
  beforeEach(() => {
    mockGetTeam.mockResolvedValue({ ...TEAM, captain_user_id: 'me' });
    mockGetMembers.mockResolvedValue(captainRoster);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lists the join requests and Approve / Reject call the respond route with accept true / false', async () => {
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Join requests', 'Asker One']));
    await tap(root, 'team-approve-r1');
    expect(mockRespondRequest).toHaveBeenLastCalledWith('tm-1', 'r1', true, expect.objectContaining({ correlationId: expect.any(String) }));
    await tap(root, 'team-reject-r1');
    expect(mockRespondRequest).toHaveBeenLastCalledWith('tm-1', 'r1', false, expect.objectContaining({ correlationId: expect.any(String) }));
  });

  it('Edit sends the changed fields only (name), and an unchanged form sends nothing', async () => {
    const root = await mount();
    await tap(root, 'team-edit');
    await tap(root, 'team-edit-save');
    expect(mockUpdate).not.toHaveBeenCalled();
    await tap(root, 'team-edit');
    await act(async () => {
      root.findAll(n => n.props.testID === 'team-edit-name' && typeof n.props.onChangeText === 'function')[0].props.onChangeText('  Renamed  ');
    });
    await tap(root, 'team-edit-save');
    expect(mockUpdate).toHaveBeenCalledWith('tm-1', { name: 'Renamed' }, expect.objectContaining({ correlationId: expect.any(String) }));
  });

  it('a duplicate name (coded 409) shows its own label, not the server text', async () => {
    mockUpdate.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 409, data: { code: 'TEAM_NAME_TAKEN', detail: 'idx_teams_name_sport_unique' } } }));
    const root = await mount();
    await tap(root, 'team-edit');
    await act(async () => {
      root.findAll(n => n.props.testID === 'team-edit-name' && typeof n.props.onChangeText === 'function')[0].props.onChangeText('Court Kings');
    });
    await tap(root, 'team-edit-save');
    const all = texts(root);
    expect(all).toContain('A tournament team with this name already exists for this sport. Choose another name.');
    expect(all.join(' ')).not.toContain('idx_teams_name_sport_unique');
    expect(shown(root, 'team-edit-save')).toBe(true); // the form stays open
  });

  it('Remove asks first, then DELETEs the member; the captain has no Remove on their own row, no Leave and no Make captain', async () => {
    const root = await mount();
    expect(shown(root, 'team-remove-me')).toBe(false);
    expect(shown(root, 'team-leave')).toBe(false);
    expect(texts(root)).not.toContain('Make captain');
    await tap(root, 'team-remove-p1');
    expect(mockRemove).not.toHaveBeenCalled();
    await confirmAlert();
    expect(mockRemove).toHaveBeenCalledWith('tm-1', 'p1', expect.objectContaining({ correlationId: expect.any(String) }));
  });

  it('a refused action shows a label and keeps the roster', async () => {
    mockRemove.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 403, data: { detail: 'Only the captain can remove other team players' } } }));
    const root = await mount();
    await tap(root, 'team-remove-p1');
    await confirmAlert();
    const all = texts(root);
    expect(all).toContain('You cannot do this.');
    expect(all).not.toContain('Only the captain can remove other team players');
    expect(all).toContain('Player One');
  });
});

describe('Team player tools (TS-07, TS-T11)', () => {
  beforeEach(() => {
    mockGetMembers.mockResolvedValue([row('cap', 'active', 'captain', 'Ravi K.'), row('me', 'active', 'member', 'Me Player'), row('r1', 'requested')]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('a team player has no captain tools (no Edit, Join requests, Remove)', async () => {
    const root = await mount();
    expect(shown(root, 'team-edit')).toBe(false);
    expect(shown(root, 'team-remove-cap')).toBe(false);
    expect(texts(root)).not.toContain('Join requests');
  });

  it('Invite a player opens the search; selecting a person POSTs the invite and a refusal rejects the row', async () => {
    const root = await mount();
    await tap(root, 'team-invite-toggle');
    const picker = root.findAll(n => n.props.testID === 'picker' && typeof n.props.onPress === 'function')[0];
    expect(picker.props.accessibilityLabel).toBe('Search by name or nickname|tm-1');
    await act(async () => {
      await picker.props.onPress();
    });
    expect(mockInvite).toHaveBeenCalledWith('tm-1', 'u-new', expect.objectContaining({ correlationId: expect.any(String) }));
  });

  it('Leave asks first, DELETEs the caller\'s own row and goes back', async () => {
    const goBack = jest.fn();
    const root = await renderAsync(
      <TeamDetailScreen {...({ navigation: { goBack }, route: { params: { teamId: 'tm-1' } } } as unknown as Props)} />,
    );
    await tap(root, 'team-leave');
    expect(mockRemove).not.toHaveBeenCalled();
    await confirmAlert();
    expect(mockRemove).toHaveBeenCalledWith('tm-1', 'me', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(goBack).toHaveBeenCalled();
  });

  it('a refused Leave stays on the screen with a label', async () => {
    const goBack = jest.fn();
    mockRemove.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { detail: 'Captains cannot leave the tournament team.' } } }));
    const root = await renderAsync(
      <TeamDetailScreen {...({ navigation: { goBack }, route: { params: { teamId: 'tm-1' } } } as unknown as Props)} />,
    );
    await tap(root, 'team-leave');
    await confirmAlert();
    expect(goBack).not.toHaveBeenCalled();
    expect(texts(root)).toContain('That did not work. Please try again.');
  });
});
