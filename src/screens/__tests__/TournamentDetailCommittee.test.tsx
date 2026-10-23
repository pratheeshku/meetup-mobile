/**
 * Tournament detail: the committee invitation card (tl-c-mobile-3). The hook is mocked; the screen's job is to show the
 * card for `my_committee_invitation`, call the hook for Accept and Decline, reuse the action's correlation id for the
 * re-read, and keep every refusal as an inline state.
 */
import React from 'react';

import {
  getCommitteeInvitation,
  getFixtures,
  getRegistrations,
  getTournament,
} from '../../api/tournaments';
import { getSports } from '../../api/sports';
import { useCommitteeInvitationResponse } from '../../hooks/useCommitteeInvitationResponse';
import { act, pressables, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { CommitteeInvitationSummary, Tournament } from '../../types/tournament';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { CommitteeAnswerOutcome } from '../../utils/committeeInvitation';
import TournamentDetailScreen from '../TournamentDetailScreen';

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

jest.mock('../../api/tournaments', () => ({
  getTournament: jest.fn(),
  getFixtures: jest.fn(),
  getRegistrations: jest.fn(),
  getCommitteeInvitation: jest.fn(),
  registerForTournament: jest.fn(),
  withdrawFromTournament: jest.fn(),
  cancelTournament: jest.fn(),
  getTournamentClosure: jest.fn().mockResolvedValue(null),
  putTournamentClosure: jest.fn(),
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../hooks/useCommitteeInvitationResponse', () => ({ useCommitteeInvitationResponse: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const mockGetTournament = getTournament as jest.Mock;
const mockGetCard = getCommitteeInvitation as jest.Mock;
const mockHook = useCommitteeInvitationResponse as jest.Mock;

const TOURNAMENT: Tournament = {
  id: 't-1',
  name: 'Punggol Open 2026',
  description: '',
  sport: 'badminton',
  organiser_id: 'organiser-id-hidden',
  organiser_nickname: '',
  format: 'knockout',
  status: 'upcoming',
  registration_open: false,
  participant_count: 0,
  max_participants: 8,
  starts_at: '2026-11-14T10:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'none',
  is_organiser: false,
  my_committee_invitation: 'pending',
};
const INVITED: Tournament = TOURNAMENT;
const PLAIN: Tournament = { ...TOURNAMENT, my_committee_invitation: null };
const CARD: CommitteeInvitationSummary = {
  tournament_id: 't-1',
  status: 'upcoming',
  title: 'Punggol Open 2026',
  sport: 'badminton',
  starts_at: '2026-11-14T10:00:00Z',
  ends_at: '2026-11-15T10:00:00Z',
  organizer_name: 'Ravi K.',
};

const DONE: CommitteeAnswerOutcome = { state: 'done', labelKey: null, refresh: true };
const refusal = (state: CommitteeAnswerOutcome['state'], labelKey: string): CommitteeAnswerOutcome =>
  ({ state, labelKey, refresh: true }) as CommitteeAnswerOutcome;

/** The hook, mocked: `respond` re-reads through the callback the screen gave it, like the real one does. */
const respond = jest.fn();
let refreshFromScreen: (correlationId: string) => Promise<void>;
const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, dispatch: jest.fn() };

const mount = (): Promise<Instance> =>
  renderAsync(
    <TournamentDetailScreen
      {...({
        route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
        navigation,
      } as unknown as Props)}
    />,
  );
const press = (root: Instance, testID: string): Instance | undefined =>
  pressables(root).find(node => node.props.testID === testID);
const tap = async (root: Instance, testID: string): Promise<void> => {
  await act(async () => {
    await press(root, testID)!.props.onPress();
  });
};

beforeEach(() => {
  mockGetTournament.mockReset().mockResolvedValue(INVITED);
  mockCardReset();
  (getFixtures as jest.Mock).mockReset().mockResolvedValue([]);
  (getRegistrations as jest.Mock).mockReset().mockResolvedValue([]);
  (getSports as jest.Mock).mockReset().mockRejectedValue(new Error('down'));
  __resetSportDisplayNamesCacheForTests();
  navigation.navigate.mockReset();
  respond.mockReset().mockImplementation(async () => {
    await refreshFromScreen('cid-1');
    return DONE;
  });
  mockHook.mockReset().mockImplementation((_id: string, refresh: (correlationId: string) => Promise<void>) => {
    refreshFromScreen = refresh;
    return { busy: null, error: null, respond };
  });
});
function mockCardReset(): void {
  mockGetCard.mockReset().mockResolvedValue(CARD);
}

describe('committee invitation card on the tournament detail', () => {
  it('shows at the top, above the tournament, with the inviter by name and no id', async () => {
    const root = await mount();
    const all = texts(root);
    expect(all).toContain('Ravi K. invited you to the committee');
    expect(all.indexOf('Ravi K. invited you to the committee')).toBeLessThan(all.indexOf('badminton · knockout'));
    expect(press(root, 'committee-invitation-accept')).toBeDefined();
    expect(press(root, 'committee-invitation-decline')).toBeDefined();
    expect(mockGetCard).toHaveBeenCalledWith('t-1');
    expect(all.join(' ')).not.toContain('organiser-id-hidden');
  });

  it('no invitation: no card and no card read', async () => {
    mockGetTournament.mockResolvedValue(PLAIN);
    const root = await mount();
    expect(root.findAllByProps({ testID: 'committee-invitation-card' })).toHaveLength(0);
    expect(mockGetCard).not.toHaveBeenCalled();
  });

  it('Accept: the hook is called with true, the tournament is re-read with the same correlation id, the card closes', async () => {
    mockGetTournament.mockResolvedValueOnce(INVITED).mockResolvedValue({ ...PLAIN, my_invite_access: 'full' });
    const root = await mount();
    await tap(root, 'committee-invitation-accept');
    expect(respond).toHaveBeenCalledWith(true);
    expect(mockGetTournament).toHaveBeenLastCalledWith('t-1', { correlationId: 'cid-1' });
    expect(getFixtures).toHaveBeenLastCalledWith('t-1', { correlationId: 'cid-1' });
    expect(getRegistrations).toHaveBeenLastCalledWith('t-1', { correlationId: 'cid-1' });
    expect(root.findAllByProps({ testID: 'committee-invitation-card' })).toHaveLength(0);
    expect(texts(root)).toContain('Punggol Open 2026');
  });

  it('Decline: the hook is called with false, the card closes and the plain tournament shows', async () => {
    mockGetTournament.mockResolvedValueOnce(INVITED).mockResolvedValue(PLAIN);
    const root = await mount();
    await tap(root, 'committee-invitation-decline');
    expect(respond).toHaveBeenCalledWith(false);
    expect(mockGetTournament).toHaveBeenLastCalledWith('t-1', { correlationId: 'cid-1' });
    expect(root.findAllByProps({ testID: 'committee-invitation-card' })).toHaveLength(0);
    expect(texts(root)).toContain('badminton · knockout');
  });

  it('the card closes on success even if the re-read still says pending', async () => {
    const root = await mount();
    await tap(root, 'committee-invitation-accept');
    expect(root.findAllByProps({ testID: 'committee-invitation-card' })).toHaveLength(0);
  });

  it('reports the in-flight answer from the hook to the card (buttons disabled, busy)', async () => {
    mockHook.mockImplementation((_id: string, refresh: (correlationId: string) => Promise<void>) => {
      refreshFromScreen = refresh;
      return { busy: 'accept', error: null, respond };
    });
    const root = await mount();
    expect(press(root, 'committee-invitation-accept')!.props.disabled).toBe(true);
    expect(press(root, 'committee-invitation-decline')!.props.disabled).toBe(true);
    expect(press(root, 'committee-invitation-accept')!.props.accessibilityState).toMatchObject({ busy: true });
  });

  it.each([
    ['already_active', 'mob.committee_invite.already_active', 'You are already on this committee.'],
    ['closed', 'mob.committee_invite.closed', 'This committee invitation is no longer open.'],
    ['not_invited', 'mob.committee_invite.not_invited', 'You have no committee invitation for this tournament.'],
    ['cancelled', 'mob.committee_invite.cancelled', 'This tournament was cancelled.'],
    ['ended', 'mob.committee_invite.ended', 'This tournament has ended, so the committee can no longer change.'],
    ['disabled', 'mob.committee_invite.disabled', 'Committee invitations are not available right now. Please try again later.'],
  ] as const)('%s after an answer: the label stays inline on the card, even once the tournament no longer says pending', async (state, key, text) => {
    mockGetTournament.mockResolvedValueOnce(INVITED).mockResolvedValue(PLAIN);
    respond.mockImplementation(async () => {
      await refreshFromScreen('cid-2');
      return refusal(state, key);
    });
    const root = await mount();
    await tap(root, 'committee-invitation-accept');
    expect(texts(root)).toContain(text);
    expect(press(root, 'committee-invitation-accept')).toBeUndefined();
    expect(press(root, 'committee-invitation-retry')).toBeUndefined();
  });

  it('failed: label and Retry; Retry repeats the same answer', async () => {
    respond.mockReset().mockResolvedValueOnce(refusal('failed', 'mob.committee_invite.failed')).mockResolvedValue(DONE);
    const root = await mount();
    await tap(root, 'committee-invitation-decline');
    expect(texts(root)).toContain('Could not send your answer. Please try again.');
    await tap(root, 'committee-invitation-retry');
    expect(respond.mock.calls).toEqual([[false], [false]]);
    expect(root.findAllByProps({ testID: 'committee-invitation-card' })).toHaveLength(0);
  });

  it('the card cannot be read (network): failed label and Retry; Retry reads it again', async () => {
    mockGetCard.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(CARD);
    const root = await mount();
    expect(texts(root)).toContain('Could not send your answer. Please try again.');
    expect(press(root, 'committee-invitation-accept')).toBeUndefined();
    await tap(root, 'committee-invitation-retry');
    expect(mockGetCard).toHaveBeenCalledTimes(2);
    expect(texts(root)).toContain('Ravi K. invited you to the committee');
    expect(press(root, 'committee-invitation-retry')).toBeUndefined();
  });

  it('the card read refused with a coded state shows that label, with no Retry', async () => {
    mockGetCard.mockRejectedValue({ response: { status: 409, data: { code: 'committee_invitation_closed' } } });
    const root = await mount();
    expect(texts(root)).toContain('This committee invitation is no longer open.');
    expect(press(root, 'committee-invitation-retry')).toBeUndefined();
  });

  it('a tournament the invited person cannot view still shows the card, by itself, and does not close the screen', async () => {
    mockGetTournament.mockRejectedValue({ response: { status: 404 } });
    const root = await mount();
    expect(texts(root)).toContain('Ravi K. invited you to the committee');
    expect(texts(root)).not.toContain('badminton · knockout');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('a tournament that is gone and has no invitation closes as before', async () => {
    mockGetTournament.mockRejectedValue({ response: { status: 404 } });
    mockGetCard.mockRejectedValue({ response: { status: 404, data: { code: 'committee_not_invited' } } });
    const root = await mount();
    expect(root.findAllByProps({ testID: 'committee-invitation-card' })).toHaveLength(0);
  });
});
