/** tournament-respond: Register / Decline banner (tournament-registration AD-3, F1) and "You're invited" on Tournament Detail. */
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
  it('pending: invitation prompt with Register and Decline, never Accept', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    expect(has(root, "You're invited to this tournament")).toBe(true);
    expect(hasButton(root, 'Register')).toBe(true);
    expect(hasButton(root, 'Accept')).toBe(false);
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
    expect(hasButton(root, 'Register')).toBe(true);
    expect(hasButton(root, 'Invite players')).toBe(false);
  });
});

describe('respond', () => {
  it('Register opens the confirmation sheet, then registers once (the server accepts the invitation in the same call) and refreshes', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    const before = tournamentGets();
    expect(mockPost).not.toHaveBeenCalled();
    await press(root, 'Register');
    expect(root.findAll(n => n.props.testID === 'registration-confirm-sheet')).not.toHaveLength(0);
    server.tournament = rawTournament({ my_invitation_status: 'accepted' });
    await press(root, 'Confirm');
    expect(mockPost.mock.calls.map(c => c[0])).toEqual(['/tournaments/t-1/registrations']);
    expect(mockPost.mock.calls.some(c => c[0] === RESPOND)).toBe(false);
    expect(tournamentGets()).toBe(before + 1);
    expect(root.findAll(n => n.props.testID === 'registration-result-success')).not.toHaveLength(0);
  });

  it('Decline posts { accept: false }, refreshes, and the banner goes away', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    server.tournament = rawTournament({ my_invitation_status: null });
    await press(root, 'Decline');
    expect(mockPost).toHaveBeenCalledWith(RESPOND, { accept: false }, expect.anything());
    expect(has(root, "You're invited")).toBe(false);
    expect(hasButton(root, 'Accept')).toBe(false);
    // The banner is gone: its test id no longer renders.
    expect(root.findAll(n => n.props.testID === 'tournament-invitation-banner')).toHaveLength(0);
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
    await press(root, 'Decline');
    expect(has(root, expected)).toBe(true);
    if (detail === 'INVITES_CLOSED') {
      expect(texts(root).some(x => x.includes('INVITES_CLOSED'))).toBe(false); // never the raw code
    }
    expect(tournamentGets()).toBe(before + 1);
  });

  it('keeps the banner and shows a generic message on a network error', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    mockPost.mockRejectedValueOnce(new Error('network'));
    await press(root, 'Decline');
    expect(has(root, 'Could not send your response. Please try again.')).toBe(true);
    expect(hasButton(root, 'Register')).toBe(true);
  });

  it('a refused Register shows the label for the code in the result pop-up and keeps the banner', async () => {
    const root = await mountTournament({ my_invitation_status: 'pending' });
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'raw', code: 'TOURNAMENT_FULL' } } });
    await press(root, 'Register');
    await press(root, 'Confirm');
    expect(has(root, 'This tournament is full.')).toBe(true);
    expect(has(root, 'raw')).toBe(false);
  });
});

describe('recover after a decline', () => {
  it('an invited person who declined sees Register (not Accept), which opens the same sheet', async () => {
    const root = await mountTournament({ my_declined: true, my_invitation_status: 'pending', visibility: 'invite' });
    expect(hasButton(root, 'Accept')).toBe(false);
    const recover = root.findAll(n => n.props.testID === 'tournament-recover-button' && typeof n.props.onPress === 'function')[0];
    expect(texts(recover)).toEqual(['Register']);
    await act(async () => recover.props.onPress());
    expect(root.findAll(n => n.props.testID === 'registration-confirm-sheet')).not.toHaveLength(0);
  });
});
