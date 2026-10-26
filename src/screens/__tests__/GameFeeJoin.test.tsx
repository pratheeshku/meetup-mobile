/**
 * Game fee (teams-payments AD-8, AD-7, AD-9): fee confirmation on RSVP going and on the invitation Accept, the Payment card from `my_participation`,
 * and everything hidden while the game fee is null (switch off). The real screen, hook, sheet and API layer run; only the HTTP client is mocked.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'someone-else', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 12, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 5, user_rsvp_status: null, skill_level_requirement: 'all_levels',
  ...overrides,
});
const FEE = { registration_fee_cents: 500, registration_fee_currency: 'SGD' };

let current: Record<string, unknown> = {};
async function mount(overrides: Record<string, unknown> = {}): Promise<Instance> {
  current = rawEvent(overrides);
  mockGet.mockImplementation((url: string) => Promise.resolve({ data: url.includes('/participants') ? [] : url === '/config/client' ? {} : current }));
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const press = async (root: Instance, id: string): Promise<void> => {
  const node = root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press: ${id}`);
  await act(async () => {
    node.props.onPress();
  });
};
const everyText = (root: Instance): string => texts(root).join(' | ');
const posts = (suffix: string): any[][] => mockPost.mock.calls.filter(call => String(call[0]).endsWith(suffix));

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  __resetSportDisplayNamesCacheForTests();
});

describe('RSVP going on a game with a fee', () => {
  it('opens the confirmation first (nothing is posted), shows the fee per player, and Confirm posts accepted_fee_cents', async () => {
    const root = await mount(FEE);
    await press(root, 'join-button');
    expect(posts('/rsvp')).toHaveLength(0);
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(1);
    expect(everyText(byId(root, 'registration-fee-line')[0])).toMatch(/5\.00 per player$/);
    expect(everyText(byId(root, 'registration-fee-note')[0])).toContain('After you join');

    await press(root, 'registration-confirm');
    expect(posts('/rsvp')).toHaveLength(1);
    expect(posts('/rsvp')[0][1]).toEqual({ action: 'going', accepted_fee_cents: 500 });
    expect(posts('/rsvp')[0][2].correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a free game joins at once with the old body, no sheet', async () => {
    const root = await mount();
    await press(root, 'join-button');
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(0);
    expect(posts('/rsvp')[0][1]).toEqual({ action: 'going' });
  });

  it('FEE_CHANGED re-asks with the current fee and confirms the new amount', async () => {
    const root = await mount(FEE);
    await press(root, 'join-button');
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'x', code: 'FEE_CHANGED', registration_fee_cents: 800 } } });
    await press(root, 'registration-confirm');
    expect(everyText(byId(root, 'registration-notice')[0])).toBe('The registration fee has changed. Check the new fee and confirm again.');
    expect(everyText(byId(root, 'registration-fee-line')[0])).toMatch(/8\.00 per player$/);
    await press(root, 'registration-confirm');
    expect(posts('/rsvp')[1][1]).toEqual({ action: 'going', accepted_fee_cents: 800 });
  });

  it('after joining, the pop-up shows the number from the fresh game (my_participation) and Payment pending', async () => {
    const root = await mount(FEE);
    await press(root, 'join-button');
    current = rawEvent({
      ...FEE,
      user_rsvp_status: 'going',
      my_participation: { status: 'going', fee_cents_at_join: 500, effective_fee_cents: 500, payment_received_at: null, payment_exempt: false, payment_contact_number: '+6591234567' },
    });
    await press(root, 'registration-confirm');
    expect(everyText(byId(root, 'registration-result-success')[0])).toContain("You're in");
    expect(everyText(byId(root, 'registration-result-number')[0])).toContain('+65');
    expect(everyText(byId(root, 'registration-result-success')[0])).toContain('Payment pending');
  });

  it('an organizer-set fee with no number from the API says to ask the organizer', async () => {
    const root = await mount(FEE);
    await press(root, 'join-button');
    current = rawEvent({ ...FEE, user_rsvp_status: 'going', my_participation: { status: 'going', fee_cents_at_join: 500, effective_fee_cents: 500, payment_exempt: false } });
    await press(root, 'registration-confirm');
    expect(byId(root, 'registration-result-number')).toHaveLength(0);
    expect(everyText(byId(root, 'registration-result-payment')[0])).toContain('Ask the organizer how to pay.');
  });

  it('a waitlisted join shows no payment box', async () => {
    const root = await mount(FEE);
    await press(root, 'join-button');
    current = rawEvent({ ...FEE, user_rsvp_status: 'waitlisted', my_participation: { status: 'waitlisted', fee_cents_at_join: 500 } });
    await press(root, 'registration-confirm');
    expect(everyText(byId(root, 'registration-result-success')[0])).toContain("You're on the waitlist");
    expect(byId(root, 'registration-result-payment')).toHaveLength(0);
  });
});

describe('invitation Accept on a game with a fee', () => {
  it('opens the same confirmation and posts accept with accepted_fee_cents', async () => {
    const root = await mount({ ...FEE, visibility: 'invite_only' });
    await press(root, 'accept-button');
    expect(posts('/invitations/respond')).toHaveLength(0);
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(1);
    await press(root, 'registration-confirm');
    expect(posts('/invitations/respond')[0][1]).toEqual({ accept: true, accepted_fee_cents: 500 });
  });

  it('a free invited game accepts with the old body', async () => {
    const root = await mount({ visibility: 'invite_only' });
    await press(root, 'accept-button');
    expect(posts('/invitations/respond')[0][1]).toEqual({ accept: true });
  });
});

describe('Payment card on the game (J7 for games)', () => {
  const participation = (extra: Record<string, unknown> = {}) => ({
    status: 'going', fee_cents_at_join: 500, effective_fee_cents: 500, payment_received_at: null, payment_exempt: false, payment_contact_number: '+6591234567', ...extra,
  });

  it('a participant who is going sees amount, number and Payment pending', async () => {
    const root = await mount({ ...FEE, user_rsvp_status: 'going', my_participation: participation() });
    expect(byId(root, 'payment-card')).toHaveLength(1);
    expect(everyText(byId(root, 'payment-card')[0])).toContain('Payment pending');
    expect(everyText(byId(root, 'payment-number')[0])).toContain('+65');
  });

  it('Paid once the organizer confirmed', async () => {
    const root = await mount({ ...FEE, user_rsvp_status: 'going', my_participation: participation({ payment_received_at: '2026-11-01T10:00:00Z' }) });
    expect(everyText(byId(root, 'payment-status-chip')[0])).toBe('Paid');
  });

  it('no card for a free game, a waitlisted person, an exempt organizer row, or no participation', async () => {
    expect(byId(await mount({ user_rsvp_status: 'going', my_participation: participation({ effective_fee_cents: 0, fee_cents_at_join: 0 }) }), 'payment-card')).toHaveLength(0);
    expect(byId(await mount({ ...FEE, user_rsvp_status: 'waitlisted', my_participation: participation({ status: 'waitlisted', payment_contact_number: null }) }), 'payment-card')).toHaveLength(0);
    expect(byId(await mount({ ...FEE, user_rsvp_status: 'going', my_participation: participation({ payment_exempt: true }) }), 'payment-card')).toHaveLength(0);
    expect(byId(await mount(FEE), 'payment-card')).toHaveLength(0);
  });
});

describe('the game fee switch off (fee fields null)', () => {
  it('the API sends a null fee and the game looks and joins exactly as before', async () => {
    const root = await mount({ registration_fee_cents: null, registration_fee_currency: null });
    await press(root, 'join-button');
    expect(byId(root, 'registration-confirm-sheet')).toHaveLength(0);
    expect(posts('/rsvp')[0][1]).toEqual({ action: 'going' });
    expect(byId(root, 'payment-card')).toHaveLength(0);
  });
});
