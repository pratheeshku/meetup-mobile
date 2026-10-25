/**
 * Tournament registration on the detail screen (DES-MEETUP-ADDENDUM-tournament-registration AD-1, AD-4, AD-5, AD-9; brief M1, M2, M3, M10).
 * The real screen, hook, sheet, pop-up and API layer run; only the HTTP client is mocked.
 */
import React from 'react';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { mockGet, mockPost, rawTournament } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

const REGISTRATIONS_URL = '/tournaments/t-1/registrations';

async function mount(
  tournament: Record<string, unknown> = {},
  navigation: Record<string, unknown> = {},
): Promise<Instance> {
  const raw = rawTournament({ participation_mode: 'individual', ...tournament });
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: raw });
    if (url === REGISTRATIONS_URL) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  mockPost.mockReset().mockResolvedValue({ data: {} });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation,
  } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const pressable = (root: Instance, id: string): Instance | undefined =>
  root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const press = async (root: Instance, id: string): Promise<void> => {
  const node = pressable(root, id);
  if (!node) throw new Error(`nothing to press: ${id}`);
  await act(async () => {
    node.props.onPress();
  });
};
const everyText = (root: Instance): string => texts(root).join(' | ');
const registrationPosts = (): any[][] => mockPost.mock.calls.filter(call => call[0] === REGISTRATIONS_URL);

const refusal = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

describe('Register opens the confirmation sheet (AD-5)', () => {
  it('a free tournament shows "Free registration" and Confirm posts with no body, then the success pop-up', async () => {
    const root = await mount();
    await press(root, 'tournament-register-button');
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(1);
    expect(everyText(byId(root, 'registration-confirm-sheet')[0])).toContain('Free registration');
    expect(registrationPosts()).toHaveLength(0);

    await press(root, 'registration-confirm');
    const posts = registrationPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toBeUndefined();
    expect(posts[0][2].correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(byId(root, 'registration-result-success')).toHaveLength(1);
    expect(everyText(root)).toContain("You're registered");
  });

  it('a tournament with a fee shows it per player, says it is arranged outside the app, and sends accepted_fee_cents', async () => {
    const root = await mount({ registration_fee_cents: 1500, registration_fee_currency: 'SGD' });
    await press(root, 'tournament-register-button');
    const line = everyText(byId(root, 'registration-fee-line')[0]);
    expect(line).toMatch(/^Registration fee: .*15\.00 per player$/);
    expect(everyText(byId(root, 'registration-fee-note')[0])).toContain('arranged with the organizer outside the app');
    // No payment control anywhere on the sheet.
    expect(everyText(byId(root, 'registration-confirm-sheet')[0]).toLowerCase()).not.toMatch(/\bpay\b|\bpay now\b/);

    await press(root, 'registration-confirm');
    expect(registrationPosts()[0][1]).toEqual({ accepted_fee_cents: 1500 });
  });

  it('a team tournament reads "per tournament team"', async () => {
    const root = await mount({ participation_mode: 'team', registration_fee_cents: 4000, registration_fee_currency: 'SGD' });
    await press(root, 'tournament-register-button');
    expect(everyText(byId(root, 'registration-fee-line')[0])).toMatch(/per tournament team$/);
  });

  it('Cancel closes the sheet and sends nothing', async () => {
    const root = await mount();
    await press(root, 'tournament-register-button');
    await press(root, 'registration-cancel');
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(0);
    expect(registrationPosts()).toHaveLength(0);
  });

  it('a fee that cannot be read (an amount with no currency) blocks Confirm; nothing is sent', async () => {
    const root = await mount({ registration_fee_cents: 1500, registration_fee_currency: null });
    await press(root, 'tournament-register-button');
    expect(byId(root, 'registration-fee-unknown')).toHaveLength(1);
    expect(byId(root, 'registration-fee-line')).toHaveLength(0);
    await press(root, 'registration-confirm');
    expect(registrationPosts()).toHaveLength(0);
  });
});

describe('FEE_CHANGED re-asks with the current fee (AD-5)', () => {
  it('updates the sheet from registration_fee_cents, shows the changed-fee label, and confirms the new amount', async () => {
    const root = await mount({ registration_fee_cents: 1500, registration_fee_currency: 'SGD' });
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(409, { detail: 'The registration fee has changed', code: 'FEE_CHANGED', registration_fee_cents: 2000 }));
    await press(root, 'registration-confirm');

    expect(byId(root, 'registration-result-failure')).toHaveLength(0);
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(1);
    expect(everyText(byId(root, 'registration-notice')[0])).toBe('The registration fee has changed. Check the new fee and confirm again.');
    expect(everyText(byId(root, 'registration-fee-line')[0])).toMatch(/20\.00 per player$/);

    await press(root, 'registration-confirm');
    const posts = registrationPosts();
    expect(posts).toHaveLength(2);
    expect(posts[1][1]).toEqual({ accepted_fee_cents: 2000 });
    expect(byId(root, 'registration-result-success')).toHaveLength(1);
  });
});

describe('one label per server code, never the raw detail (AD-1)', () => {
  const CASES: Array<[string, string]> = [
    ['REGISTRATION_CLOSED', 'Registration is closed for this tournament.'],
    ['SKILL_LEVEL_REQUIRED', 'Set your skill level for this sport before you register.'],
    ['ALREADY_REGISTERED', 'You are already registered.'],
    ['TOURNAMENT_FULL', 'This tournament is full.'],
    ['INVITATION_REQUIRED', 'You need an invitation to register for this tournament.'],
    ['TEAM_REQUIRED', 'Choose a tournament team to register.'],
    ['FEE_ACK_REQUIRED', 'Confirm the registration fee to register.'],
    ['SOMETHING_NEW', 'Could not register. Please try again.'],
  ];

  it.each(CASES)('%s shows its label in the result pop-up', async (code, label) => {
    const root = await mount();
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(409, { detail: 'SECRET SERVER DETAIL', code }));
    await press(root, 'registration-confirm');
    expect(byId(root, 'registration-result-failure')).toHaveLength(1);
    expect(everyText(byId(root, 'registration-result-failure')[0])).toContain('Could not register');
    expect(everyText(byId(root, 'registration-result-message')[0])).toBe(label);
    expect(everyText(root)).not.toContain('SECRET SERVER DETAIL');
  });

  it('a body with no code at all (a 500) is the generic label', async () => {
    const root = await mount();
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(500, {}));
    await press(root, 'registration-confirm');
    expect(everyText(byId(root, 'registration-result-message')[0])).toBe('Could not register. Please try again.');
  });

  it('Try again is offered only where a retry can work (generic), and sends a second request', async () => {
    const root = await mount();
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(500, {}));
    await press(root, 'registration-confirm');
    expect(byId(root, 'registration-retry')).toHaveLength(1);
    await press(root, 'registration-retry');
    expect(registrationPosts()).toHaveLength(2);
    expect(byId(root, 'registration-result-success')).toHaveLength(1);

    const closed = await mount();
    await press(closed, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(409, { code: 'REGISTRATION_CLOSED' }));
    await press(closed, 'registration-confirm');
    expect(byId(closed, 'registration-retry')).toHaveLength(0);
  });

  it('SKILL_LEVEL_REQUIRED links to the skill-level screen', async () => {
    const navigate = jest.fn();
    const root = await mount({}, { getParent: () => ({ navigate }) });
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(409, { code: 'SKILL_LEVEL_REQUIRED' }));
    await press(root, 'registration-confirm');
    expect(texts(pressable(root, 'registration-skill-link')!)).toEqual(['Set skill level']);
    await press(root, 'registration-skill-link');
    expect(navigate).toHaveBeenCalledWith('Profile', { screen: 'EditSkillLevels' });
  });
});

describe('the X in the header (AD-9)', () => {
  const headerRightOf = (setOptions: jest.Mock): React.ReactElement =>
    setOptions.mock.calls[setOptions.mock.calls.length - 1][0].headerRight();

  it('goes back to the list it came from, which keeps its own state', async () => {
    const setOptions = jest.fn();
    const goBack = jest.fn();
    const navigate = jest.fn();
    await mount(
      {},
      {
        setOptions,
        goBack,
        navigate,
        canGoBack: () => true,
        getState: () => ({ index: 1, routes: [{ name: 'TournamentsList' }, { name: 'TournamentDetail' }] }),
      },
    );
    const x = (await renderAsync(headerRightOf(setOptions))) as Instance;
    await press(x, 'tournament-close');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('with no list behind it (push, share link, deep link) opens Tournaments at its defaults', async () => {
    const setOptions = jest.fn();
    const goBack = jest.fn();
    const navigate = jest.fn();
    await mount(
      {},
      { setOptions, goBack, navigate, canGoBack: () => false, getState: () => ({ index: 0, routes: [{ name: 'TournamentDetail' }] }) },
    );
    const x = (await renderAsync(headerRightOf(setOptions))) as Instance;
    await press(x, 'tournament-close');
    expect(goBack).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('TournamentsList', expect.objectContaining({ segment: 'tournaments', scope: 'mine' }));
  });

  it('has an accessible Close label', async () => {
    const setOptions = jest.fn();
    await mount({}, { setOptions });
    const x = (await renderAsync(headerRightOf(setOptions))) as Instance;
    expect(pressable(x, 'tournament-close')!.props.accessibilityLabel).toBe('Close');
  });
});

describe('fee on the tournament view (AD-4 Display, F2)', () => {
  const line = (root: Instance): string | null => {
    const found = byId(root, 'tournament-fee-line')[0];
    return found ? texts(found).join('') : null;
  };

  it('shows the per-player fee from cents and currency', async () => {
    expect(line(await mount({ registration_fee_cents: 1500, registration_fee_currency: 'SGD' }))).toMatch(/^Registration fee: .*15\.00 per player$/);
  });

  it('shows the per-team fee for a team tournament', async () => {
    expect(line(await mount({ participation_mode: 'team', registration_fee_cents: 4000, registration_fee_currency: 'SGD' }))).toMatch(/per tournament team$/);
  });

  it('shows "Free registration" for a fee of 0', async () => {
    expect(line(await mount({ registration_fee_cents: 0, registration_fee_currency: 'SGD' }))).toBe('Free registration');
  });

  it('shows nothing while the fee is null (flag off) or has no currency to format with', async () => {
    expect(line(await mount({ registration_fee_cents: null, registration_fee_currency: null }))).toBeNull();
    expect(line(await mount({}))).toBeNull();
    expect(line(await mount({ registration_fee_cents: 1500, registration_fee_currency: null }))).toBeNull();
  });
});

describe('legacy page: the organizer registers like everyone else (TR-06, F3)', () => {
  it('the organizer sees Register (alone, with no Decline) and registers through the same sheet', async () => {
    const root = await mount({ organizer_id: 'user-me' });
    expect(byId(root, 'tournament-register-button')).not.toHaveLength(0);
    expect(byId(root, 'tournament-decline-button')).toHaveLength(0);
    await press(root, 'tournament-register-button');
    await press(root, 'registration-confirm');
    expect(registrationPosts()).toHaveLength(1);
    expect(byId(root, 'registration-result-success')).toHaveLength(1);
  });

  it('gets no exemption: a missing skill level is refused with its label, like any player', async () => {
    const root = await mount({ organizer_id: 'user-me' });
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(409, { code: 'SKILL_LEVEL_REQUIRED' }));
    await press(root, 'registration-confirm');
    expect(everyText(byId(root, 'registration-result-message')[0])).toBe('Set your skill level for this sport before you register.');
  });

  it('a full tournament is refused for the organizer as for anyone', async () => {
    const root = await mount({ organizer_id: 'user-me' });
    await press(root, 'tournament-register-button');
    mockPost.mockRejectedValueOnce(refusal(409, { code: 'TOURNAMENT_FULL' }));
    await press(root, 'registration-confirm');
    expect(everyText(byId(root, 'registration-result-message')[0])).toBe('This tournament is full.');
  });

  it('once registration has closed the organizer sees no Register button, like everyone else', async () => {
    const root = await mount({ organizer_id: 'user-me', registration_closes_at: '2020-01-01T00:00:00Z' });
    expect(byId(root, 'tournament-register-button')).toHaveLength(0);
  });
});
