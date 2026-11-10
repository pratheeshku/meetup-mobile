/**
 * Pending section of Groups > Tournament teams > Mine (NE-05, AD-5): hidden when empty, the count badge on the Tournament teams segment,
 * each of Accept / Decline (invitation) and Approve / Decline (request) calls its respond endpoint, then Pending and Mine are read again;
 * a refusal shows its label and never the server text.
 */
import React from 'react';

import GroupsScreen from '../../screens/GroupsScreen';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';

type Props = React.ComponentProps<typeof GroupsScreen>;

const mockGetMyTeams = jest.fn();
const mockGetPending = jest.fn();
const mockRespondInvite = jest.fn();
const mockRespondRequest = jest.fn();
jest.mock('../../api/groups', () => ({ getGroups: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 }) }));
jest.mock('../../api/teams', () => ({
  getMyTeams: (...a: unknown[]) => mockGetMyTeams(...a),
  getPendingTeams: (...a: unknown[]) => mockGetPending(...a),
  respondToTeamInvite: (...a: unknown[]) => mockRespondInvite(...a),
  respondToTeamRequest: (...a: unknown[]) => mockRespondRequest(...a),
}));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1', nickname: 'sam' } }) }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useScrollToTop: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn().mockResolvedValue({ data: [] }) } }));

const PENDING = {
  invitations: [
    { team_id: 't-1', team_name: 'Net Ninjas', sport: 'badminton', inviter_user_id: 'u-5', inviter_display_name: 'Aisha K', created_at: 'x' },
  ],
  requests: [
    { team_id: 't-2', team_name: 'Team Smashers', sport: 'badminton', requester_user_id: 'u-7', requester_display_name: 'Priya R', created_at: 'y' },
  ],
  pending_count: 2,
};
const EMPTY_PENDING = { invitations: [], requests: [], pending_count: 0 };

const setOptions = jest.fn();
const mount = (): Promise<Instance> =>
  renderAsync(<GroupsScreen {...({ navigation: { navigate: jest.fn(), setOptions, setParams: jest.fn() }, route: { params: { section: 'teams' } } } as unknown as Props)} />);

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const press = async (root: Instance, id: string): Promise<void> => {
  const node = root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press: ${id}`);
  await act(async () => node.props.onPress());
};

beforeEach(() => {
  mockGetMyTeams.mockReset().mockResolvedValue([]);
  mockGetPending.mockReset().mockResolvedValue(PENDING);
  mockRespondInvite.mockReset().mockResolvedValue(undefined);
  mockRespondRequest.mockReset().mockResolvedValue(undefined);
});

describe('Pending section', () => {
  it('shows invitations (team, "Invited by"), requests ("wants to join") and the count above the cards', async () => {
    const root = await mount();
    expect(byId(root, 'teams-pending')).toHaveLength(1);
    expect(texts(root)).toEqual(
      expect.arrayContaining(['Pending', 'Net Ninjas', 'Invited by Aisha K', 'Team Smashers', 'Priya R wants to join', 'Accept', 'Approve', 'Decline']),
    );
    expect(byId(root, 'segment-badge-teams')).toHaveLength(1);
    expect(texts(byId(root, 'segment-badge-teams')[0])).toEqual(['2']);
  });

  it('is hidden, with no badge, when pending_count is 0', async () => {
    mockGetPending.mockResolvedValue(EMPTY_PENDING);
    const root = await mount();
    expect(byId(root, 'teams-pending')).toHaveLength(0);
    expect(byId(root, 'segment-badge-teams')).toHaveLength(0);
  });

  it('is hidden, with no badge, when the pending read fails', async () => {
    mockGetPending.mockRejectedValue(new Error('network'));
    const root = await mount();
    expect(byId(root, 'teams-pending')).toHaveLength(0);
    expect(byId(root, 'segment-badge-teams')).toHaveLength(0);
  });

  it.each([
    ['Accept', 'pending-invite-t-1-primary', 'invite', ['t-1', true]],
    ['Decline invitation', 'pending-invite-t-1-secondary', 'invite', ['t-1', false]],
    ['Approve', 'pending-request-t-2-u-7-primary', 'request', ['t-2', 'u-7', true]],
    ['Decline request', 'pending-request-t-2-u-7-secondary', 'request', ['t-2', 'u-7', false]],
  ])('%s calls its respond endpoint once, then reads Pending and Mine again', async (_name, id, kind, args) => {
    const root = await mount();
    const pendingReads = mockGetPending.mock.calls.length;
    const mineReads = mockGetMyTeams.mock.calls.length;
    mockGetPending.mockResolvedValue(EMPTY_PENDING);
    await press(root, id);
    const fn = kind === 'invite' ? mockRespondInvite : mockRespondRequest;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0].slice(0, args.length)).toEqual(args);
    expect(fn.mock.calls[0][args.length]).toEqual({ correlationId: expect.any(String) });
    expect(mockGetPending.mock.calls.length).toBe(pendingReads + 1);
    expect(mockGetMyTeams.mock.calls.length).toBeGreaterThan(mineReads);
    expect(byId(root, 'teams-pending')).toHaveLength(0);
  });

  it('a refusal shows its label, not the server text, and still reads again', async () => {
    mockRespondInvite.mockRejectedValue({ response: { status: 409, data: { detail: 'No pending invite found', code: 'SOMETHING_UNKNOWN' } } });
    const root = await mount();
    const pendingReads = mockGetPending.mock.calls.length;
    await press(root, 'pending-invite-t-1-primary');
    const error = byId(root, 'teams-pending-error');
    expect(error).toHaveLength(1);
    expect(texts(error[0]).join('')).toBe('That did not work. Please try again.');
    expect(texts(root)).not.toContain('No pending invite found');
    expect(mockGetPending.mock.calls.length).toBe(pendingReads + 1);
  });
});
