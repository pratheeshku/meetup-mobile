/** Organizer payments panel of a game (teams-payments v1.2 AD-9): tiles and Cash collected from the server, a Paid switch per going player. */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn(), put: jest.fn() } }));
let mockUser = 'u-org';
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser, nickname: 'Sam' } }) }));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;

const rawEvent = (over: Record<string, unknown> = {}) => ({
  id: 'evt-1', organizer_id: 'u-org', sport: 'badminton', title: 'Friday doubles', visibility: 'public', capacity: 12,
  starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true, status: 'upcoming', venue_name: 'Hall',
  going_count: 3, user_rsvp_status: 'going', skill_level_requirement: 'all_levels', registration_fee_cents: 500, registration_fee_currency: 'SGD', ...over,
});
const part = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id: `p-${id}`, event_id: 'evt-1', user_id: id, status: 'going', joined_at: '2026-10-24T00:00:00Z', user_display_name: name,
  payment_received_at: null, effective_fee_cents: 500, payment_exempt: false, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ payments_enabled: true, registered: 3, paid: 1, unpaid: 1, exempt: 1, collected_cents: 500, currency: 'SGD', fee_cents: 500, ...over });

const server: Record<string, any> = {};
async function mount(over: { event?: Record<string, unknown>; config?: Record<string, unknown>; parts?: unknown[]; summary?: unknown } = {}): Promise<Instance> {
  server.event = rawEvent(over.event);
  server.parts = over.parts ?? [part('u-org', 'Olivia', { payment_exempt: true }), part('a', 'Mei Lin', { payment_received_at: '2026-10-25T00:00:00Z' }), part('b', 'Dev P'), part('w', 'Wait Lister', { status: 'waitlisted' })];
  server.summary = over.summary ?? summary();
  const config = over.config ?? { game_fee_enabled: true, game_fee_currency: 'SGD', game_fee_max_cents: 100000 };
  get.mockReset().mockImplementation((url: string) => {
    if (url === '/config/client') return Promise.resolve({ data: config });
    if (url.endsWith('/payments/summary')) return server.summary instanceof Error ? Promise.reject(server.summary) : Promise.resolve({ data: server.summary });
    if (url.endsWith('/participants')) return Promise.resolve({ data: server.parts });
    return Promise.resolve({ data: server.event });
  });
  put.mockReset().mockResolvedValue({ data: {} });
  const props = { route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } }, navigation: { goBack: jest.fn() } } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}
const host = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const sw = (root: Instance, id: string): Instance => root.findAll(n => n.props.testID === id && typeof n.props.onValueChange === 'function')[0];
const flip = async (root: Instance, id: string, v: boolean): Promise<void> => {
  await act(async () => {
    await sw(root, id).props.onValueChange(v);
  });
};
const of = (root: Instance, id: string): string => texts(host(root, id)[0]).join(' ');

beforeEach(() => {
  mockUser = 'u-org';
  __resetSportDisplayNamesCacheForTests();
});

describe('visibility', () => {
  it('the organizer sees the panel with tiles and Cash collected from the summary', async () => {
    const root = await mount();
    expect(host(root, 'game-payments-panel')).toHaveLength(1);
    expect(of(root, 'tile-registered')).toContain('3');
    expect(of(root, 'tile-paid')).toContain('1');
    expect(of(root, 'tile-unpaid')).toContain('1');
    expect(of(root, 'cash-collected')).toMatch(/5\.00/);
    expect(get.mock.calls.some(c => c[0] === '/events/evt-1/payments/summary')).toBe(true);
  });

  it('is hidden for a player, with the game fee switch off, for a free game, and when the server says payments are off', async () => {
    mockUser = 'u-other';
    expect(host(await mount({ event: { organizer_id: 'u-org' } }), 'game-payments-panel')).toHaveLength(0);
    mockUser = 'u-org';
    expect(host(await mount({ config: { game_fee_enabled: false } }), 'game-payments-panel')).toHaveLength(0);
    expect(host(await mount({ event: { registration_fee_cents: null, registration_fee_currency: null } }), 'game-payments-panel')).toHaveLength(0);
    expect(host(await mount({ summary: summary({ payments_enabled: false }) }), 'game-payments-panel')).toHaveLength(0);
  });
});

describe('rows', () => {
  it('one row per going player; the organizer row has the chip and no switch; a waitlisted person has no row', async () => {
    const root = await mount();
    expect(host(root, 'game-payment-a')).toHaveLength(1);
    expect(host(root, 'game-payment-w')).toHaveLength(0);
    expect(texts(host(root, 'game-payment-u-org')[0])).toContain('Organizer');
    expect(sw(root, 'game-paid-u-org')).toBeUndefined();
    expect(sw(root, 'game-paid-a').props.value).toBe(true);
    expect(sw(root, 'game-paid-b').props.value).toBe(false);
  });
});

describe('the Paid switch', () => {
  it('sends { received } and moves the tiles from the answer', async () => {
    const root = await mount();
    put.mockResolvedValueOnce({ data: { user_id: 'b', payment_received_at: '2026-10-26T00:00:00Z', effective_fee_cents: 500, summary: summary({ paid: 2, unpaid: 0, collected_cents: 1000 }) } });
    await flip(root, 'game-paid-b', true);
    expect(put).toHaveBeenCalledWith('/events/evt-1/participants/b/payment', { received: true }, expect.objectContaining({ correlationId: expect.any(String) }));
    expect(of(root, 'tile-paid')).toContain('2');
    expect(of(root, 'cash-collected')).toMatch(/10\.00/);
    expect(sw(root, 'game-paid-b').props.value).toBe(true);
  });

  it('undo sends received false', async () => {
    const root = await mount();
    put.mockResolvedValueOnce({ data: { user_id: 'a', payment_received_at: null, summary: summary({ paid: 0, unpaid: 2, collected_cents: 0 }) } });
    await flip(root, 'game-paid-a', false);
    expect(put.mock.calls[0][1]).toEqual({ received: false });
    expect(sw(root, 'game-paid-a').props.value).toBe(false);
  });

  it.each([
    ['NO_FEE', 'There is no fee to confirm for this entry.'],
    ['PAYMENT_CLOSED', 'This is closed, so payments can no longer be changed.'],
    ['EVENT_NOT_ACTIVE', 'This game is cancelled, so payments can no longer be changed.'],
    ['PARTICIPANT_NOT_FOUND', 'This player could not be found. They may have left the game.'],
    ['PAYMENT_NOT_APPLICABLE', 'Only a player who is going can have a payment.'],
  ])('%s shows its own label, never the server text; the switch stays', async (code, label) => {
    const root = await mount();
    put.mockRejectedValueOnce({ response: { status: code === 'PARTICIPANT_NOT_FOUND' ? 404 : 409, data: { detail: 'RAW', code } } });
    await flip(root, 'game-paid-b', true);
    expect(of(root, 'game-payment-error-b')).toBe(label);
    expect(sw(root, 'game-paid-b').props.value).toBe(false);
    expect(texts(root).join(' ')).not.toContain('RAW');
  });

  it('a 500 shows the generic text', async () => {
    const root = await mount();
    put.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    await flip(root, 'game-paid-b', true);
    expect(of(root, 'game-payment-error-b')).toBe('Something went wrong on our side. Please try again.');
  });
});

describe('a failed summary read', () => {
  it('leaves rows without tiles or switches', async () => {
    const root = await mount({ summary: new Error('down') });
    expect(host(root, 'participants-summary')).toHaveLength(0);
    expect(sw(root, 'game-paid-b')).toBeUndefined();
    expect(host(root, 'game-payments-failed')).toHaveLength(1);
  });
});
