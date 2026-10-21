/** tournament-respond: Accept / Decline banner and "You're invited" on Tournament Detail. */
import { act, pressableLabelled, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import {
  mockGet,
  mockPost,
  mountTournament,
  rawTournament,
  server,
} from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const has = (root: Instance, label: string): boolean => texts(root).includes(label);
const hasButton = (root: Instance, label: string): boolean =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').length > 0;
const press = async (root: Instance, label: string): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, label).props.onPress();
  });
};
const tournamentGets = (): number => mockGet.mock.calls.filter(c => c[0] === '/tournaments/t-1').length;
const RESPOND = '/tournaments/t-1/invitations/respond';

describe('banner per my_invitation_status', () => {
  it('pending: invitation prompt with Accept and Decline', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    expect(has(root, "You're invited to this tournament")).toBe(true);
    expect(hasButton(root, 'Accept')).toBe(true);
    expect(hasButton(root, 'Decline')).toBe(true);
  });

  it('accepted: "You\'re invited", no buttons', async () => {
    const root = await mountTournament({ my_invitation_status: 'accepted' });
    expect(has(root, "You're invited")).toBe(true);
    expect(hasButton(root, 'Accept')).toBe(false);
    expect(hasButton(root, 'Decline')).toBe(false);
  });

  it.each([[null], [undefined], ['declined'], ['bogus']])('%p: nothing', async status => {
    const root = await mountTournament(status === undefined ? {} : { my_invitation_status: status });
    expect(has(root, "You're invited")).toBe(false);
    expect(has(root, "You're invited to this tournament")).toBe(false);
    expect(hasButton(root, 'Accept')).toBe(false);
  });

  it('shows regardless of my_invite_access (an invitee has none)', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending', my_invite_access: 'none' });
    expect(hasButton(root, 'Accept')).toBe(true);
    expect(hasButton(root, 'Invite players')).toBe(false);
  });
});

describe('respond', () => {
  it('Accept posts { accept: true }, refreshes, then shows "You\'re invited"', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    const before = tournamentGets();
    server.tournament = rawTournament({ my_invitation_status: 'accepted' });
    await press(root, 'Accept');
    expect(mockPost).toHaveBeenCalledWith(RESPOND, { accept: true }, expect.objectContaining({ correlationId: expect.any(String) }));
    expect(tournamentGets()).toBe(before + 1);
    expect(has(root, "You're invited")).toBe(true);
    expect(hasButton(root, 'Accept')).toBe(false);
  });

  it('Decline posts { accept: false }, refreshes, and the banner goes away', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    server.tournament = rawTournament({ my_invitation_status: null });
    await press(root, 'Decline');
    expect(mockPost).toHaveBeenCalledWith(RESPOND, { accept: false }, expect.anything());
    expect(has(root, "You're invited")).toBe(false);
    expect(hasButton(root, 'Accept')).toBe(false);
  });

  it.each([
    ['object detail', { code: 'INVITES_CLOSED', message: 'Registration has closed.' }, 'Registration has closed.'],
    ['string detail', 'Invitations are closed (INVITES_CLOSED)', 'Invitations are closed (INVITES_CLOSED)'],
    ['bare code', 'INVITES_CLOSED', 'Invitations are closed for this tournament.'],
  ])('409 INVITES_CLOSED (%s): shows the server text and refreshes', async (_n, detail, expected) => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    const before = tournamentGets();
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { detail } } });
    server.tournament = rawTournament({ my_invitation_status: null }); // server no longer reports it
    await press(root, 'Accept');
    expect(has(root, expected)).toBe(true);
    if (detail === 'INVITES_CLOSED') {
      expect(texts(root).some(x => x.includes('INVITES_CLOSED'))).toBe(false); // never the raw code
    }
    expect(tournamentGets()).toBe(before + 1);
  });

  it('keeps the banner and shows a generic message on a network error', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    mockPost.mockRejectedValueOnce(new Error('network'));
    await press(root, 'Accept');
    expect(has(root, 'Could not send your response. Please try again.')).toBe(true);
    expect(hasButton(root, 'Accept')).toBe(true);
  });

  it('Accepting does not register the user', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    server.tournament = rawTournament({ my_invitation_status: 'accepted' });
    await press(root, 'Accept');
    expect(mockPost.mock.calls.map(c => c[0])).toEqual([RESPOND]);
  });
});
