/**
 * Organizer fee edit (DES-MEETUP-ADDENDUM-tournament-registration AD-4 "Set and edit"; brief tr-mobile-5 M2). The real screen, sheet and API layer
 * run; only the HTTP client is mocked. The "players have registered" signal is the count of registration rows that are not withdrawn.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import TournamentDetailScreen from '../TournamentDetailScreen';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { mockGet, mockPost, rawTournament } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

type Props = React.ComponentProps<typeof TournamentDetailScreen>;
const mockPatch = apiClient.patch as jest.Mock;

const row = (id: string, status: string) => ({ id, user_id: `p-${id}`, registered_at: '2026-10-20T00:00:00Z', participant_name: `P ${id}`, status });
const FEE_ON = { tournament_fee_enabled: true, tournament_fee_currency: 'SGD', tournament_fee_max_cents: 100000 };

async function mount(
  tournament: Record<string, unknown> = {},
  opts: { config?: Record<string, unknown>; registrations?: unknown[] } = {},
): Promise<Instance> {
  const raw = rawTournament({
    organizer_id: 'user-me',
    status: 'registration_open',
    registration_closes_at: '2999-01-01T00:00:00Z',
    registration_fee_cents: 1500,
    registration_fee_currency: 'SGD',
    payment_contact_number: '+6591234567',
    ...tournament,
  });
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: raw });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: opts.registrations ?? [] });
    if (url === '/config/client') return Promise.resolve({ data: opts.config ?? FEE_ON });
    return Promise.resolve({ data: [] });
  });
  mockPost.mockReset().mockResolvedValue({ data: {} });
  mockPatch.mockReset().mockResolvedValue({ data: {} });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation: {},
  } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const press = async (root: Instance, id: string): Promise<void> => {
  const node = root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press: ${id}`);
  await act(async () => {
    node.props.onPress();
  });
};
const type = async (root: Instance, value: string): Promise<void> => {
  const input = byId(root, 'fee-edit-input')[0];
  await act(async () => {
    input.props.onChangeText(value);
  });
};
const open = async (root: Instance): Promise<void> => press(root, 'fee-edit-row');
const text = (root: Instance, id: string): string => texts(byId(root, id)[0]).join('');
const everyText = (root: Instance): string => texts(root).join(' | ');
const tournamentReads = (): number => mockGet.mock.calls.filter(call => call[0] === '/tournaments/t-1').length;

describe('who sees the Registration fee row', () => {
  it('the organizer, with the flag on and registration open', async () => {
    const root = await mount();
    expect(byId(root, 'fee-edit-row')).toHaveLength(1);
    expect(everyText(byId(root, 'fee-edit-row')[0])).toMatch(/^Registration fee \| .*15\.00$/);
  });

  it('not a player or committee member (organizer only)', async () => {
    expect(byId(await mount({ organizer_id: 'someone-else' }), 'fee-edit-row')).toHaveLength(0);
  });

  it('not when the server fee flag is off or the config cannot be read', async () => {
    expect(byId(await mount({}, { config: { tournament_fee_enabled: false } }), 'fee-edit-row')).toHaveLength(0);
    expect(byId(await mount({}, { config: {} }), 'fee-edit-row')).toHaveLength(0);
  });

  it('not once registration is closed (status) or its date has passed', async () => {
    expect(byId(await mount({ status: 'registration_closed' }), 'fee-edit-row')).toHaveLength(0);
    expect(byId(await mount({ registration_closes_at: '2020-01-01T00:00:00Z' }), 'fee-edit-row')).toHaveLength(0);
    expect(byId(await mount({ status: 'upcoming' }), 'fee-edit-row')).toHaveLength(0);
  });
});

describe('the sheet', () => {
  it('is prefilled with the stored fee as an amount, empty when free, and reads nothing extra', async () => {
    const root = await mount();
    const reads = mockGet.mock.calls.length;
    await open(root);
    expect(byId(root, 'fee-edit-input')[0].props.value).toBe('15.00');
    expect(everyText(byId(root, 'fee-edit-sheet')[0])).toContain('Registration fee');
    expect(mockGet.mock.calls.length).toBe(reads);

    const free = await mount({ registration_fee_cents: null, registration_fee_currency: null });
    await open(free);
    expect(byId(free, 'fee-edit-input')[0].props.value).toBe('');
  });

  it('shows the hint with the currency', async () => {
    const root = await mount();
    await open(root);
    expect(everyText(byId(root, 'fee-edit-sheet')[0])).toContain('Amount in SGD, for example 15.00. Leave empty for a free tournament.');
  });
});

describe('the warning', () => {
  const REGISTERED = [row('a', 'registered'), row('b', 'withdrawn')];

  it('shows when players have registered AND the value changed', async () => {
    const root = await mount({}, { registrations: REGISTERED });
    await open(root);
    expect(byId(root, 'fee-edit-warning')).toHaveLength(0);
    await type(root, '20');
    expect(text(root, 'fee-edit-warning')).toBe('Players have already registered. Changing the fee does not change what they confirmed. The change is logged.');
  });

  it('also when the fee is cleared', async () => {
    const root = await mount({}, { registrations: REGISTERED });
    await open(root);
    await type(root, '');
    expect(byId(root, 'fee-edit-warning')).toHaveLength(1);
  });

  it('not when the value is unchanged (15 equals the stored 15.00)', async () => {
    const root = await mount({}, { registrations: REGISTERED });
    await open(root);
    await type(root, '15');
    expect(byId(root, 'fee-edit-warning')).toHaveLength(0);
  });

  it('not when nobody has registered, or only withdrawn rows exist', async () => {
    const none = await mount();
    await open(none);
    await type(none, '20');
    expect(byId(none, 'fee-edit-warning')).toHaveLength(0);

    const withdrawn = await mount({}, { registrations: [row('a', 'withdrawn'), row('b', 'withdrawn')] });
    await open(withdrawn);
    await type(withdrawn, '20');
    expect(byId(withdrawn, 'fee-edit-warning')).toHaveLength(0);
  });

  it('an invalid entry shows the field error and no warning', async () => {
    const root = await mount({}, { registrations: REGISTERED });
    await open(root);
    await type(root, '15.005');
    expect(byId(root, 'fee-edit-warning')).toHaveLength(0);
    expect(text(root, 'fee-edit-field-error')).toMatch(/^Enter an amount between 0 and .*1,?000\.00, with at most two decimals\.$/);
    await type(root, '2000.00');
    expect(byId(root, 'fee-edit-warning')).toHaveLength(0);
    expect(byId(root, 'fee-edit-field-error')).toHaveLength(1);
  });
});

describe('Save (PATCH /tournaments/{id})', () => {
  it('sends exactly { registration_fee_cents } as whole cents, with one correlation id, then toast, refetch and close', async () => {
    const root = await mount();
    await open(root);
    await type(root, '20.5');
    const before = tournamentReads();
    await press(root, 'fee-edit-save');
    expect(mockPatch).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPatch.mock.calls[0];
    expect(url).toBe('/tournaments/t-1');
    // teams-payments AD-7: a fee above 0 travels with the payee number (here the stored one, unchanged).
    expect(body).toEqual({ registration_fee_cents: 2050, payment_contact_number: '+6591234567' });
    expect(Object.keys(body)).toEqual(['registration_fee_cents', 'payment_contact_number']);
    expect(config.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(byId(root, 'fee-edit-sheet')).toHaveLength(0);
    expect(everyText(root)).toContain('Registration fee saved');
    expect(tournamentReads()).toBeGreaterThan(before);
  });

  it('clearing the field sends null (free)', async () => {
    const root = await mount();
    await open(root);
    await type(root, '');
    await press(root, 'fee-edit-save');
    expect(mockPatch.mock.calls[0][1]).toEqual({ registration_fee_cents: null });
  });

  it('an unchanged value sends nothing and just closes', async () => {
    const root = await mount();
    await open(root);
    await press(root, 'fee-edit-save');
    expect(mockPatch).not.toHaveBeenCalled();
    expect(byId(root, 'fee-edit-sheet')).toHaveLength(0);
  });

  it('an invalid entry cannot be saved', async () => {
    const root = await mount();
    await open(root);
    // The field itself drops letters and signs as they are typed ("-1" becomes "1"), so the entries that can be invalid are the ones it lets through.
    await type(root, '15.005');
    const save = root.findAll(n => n.props.testID === 'fee-edit-save' && typeof n.props.onPress === 'function')[0];
    await act(async () => save.props.onPress());
    expect(mockPatch).not.toHaveBeenCalled();
    await type(root, '1.2.3');
    await act(async () => save.props.onPress());
    expect(mockPatch).not.toHaveBeenCalled();
    await type(root, '-1');
    expect(byId(root, 'fee-edit-input')[0].props.value).toBe('1');
  });
});

describe('errors', () => {
  const failWith = async (error: unknown): Promise<Instance> => {
    const root = await mount();
    await open(root);
    await type(root, '20');
    mockPatch.mockRejectedValueOnce(error);
    await press(root, 'fee-edit-save');
    return root;
  };

  it('409 reads "Registration has closed", and the sheet stays open', async () => {
    const root = await failWith({ response: { status: 409, data: { detail: 'RAW' } } });
    expect(text(root, 'fee-edit-error')).toBe('Registration has closed, so the fee can no longer be changed.');
    expect(byId(root, 'fee-edit-sheet')).toHaveLength(1);
    expect(everyText(root)).not.toContain('RAW');
  });

  it('422 reads the field error with the maximum', async () => {
    const root = await failWith({ response: { status: 422, data: { code: 'FEE_INVALID' } } });
    expect(text(root, 'fee-edit-error')).toMatch(/^Enter an amount between 0 and .*1,?000\.00, with at most two decimals\.$/);
  });

  it.each([[500], [403], [undefined]])('anything else (%p) reads "Could not save the fee"', async status => {
    const root = await failWith(status === undefined ? new Error('network') : { response: { status } });
    expect(text(root, 'fee-edit-error')).toBe('Could not save the fee. Please try again.');
    expect(byId(root, 'fee-edit-sheet')).toHaveLength(1);
  });

  it('editing again clears the error', async () => {
    const root = await failWith({ response: { status: 500 } });
    await type(root, '21');
    expect(byId(root, 'fee-edit-error')).toHaveLength(0);
  });
});

describe('payee number (teams-payments AD-7)', () => {
  it('setting a fee on a tournament with no stored number needs one: Save is refused with the server label and nothing is sent', async () => {
    const root = await mount({ registration_fee_cents: null, registration_fee_currency: null, payment_contact_number: null });
    await open(root);
    await type(root, '10');
    expect(byId(root, 'fee-edit-payee')).toHaveLength(1);
    await press(root, 'fee-edit-save');
    expect(mockPatch).not.toHaveBeenCalled();
    expect(text(root, 'fee-edit-error')).toBe('Enter a payment number: this tournament or game has a fee.');
  });

  it('an unchanged fee shows no number field and sends nothing', async () => {
    const root = await mount();
    await open(root);
    expect(byId(root, 'fee-edit-payee')).toHaveLength(0);
    await press(root, 'fee-edit-save');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('PAYMENT_NUMBER_INVALID from the server shows its own label', async () => {
    const root = await mount();
    mockPatch.mockRejectedValueOnce({ response: { status: 422, data: { code: 'PAYMENT_NUMBER_INVALID', detail: 'bad +6591234567' } } });
    await open(root);
    await type(root, '20');
    await press(root, 'fee-edit-save');
    expect(text(root, 'fee-edit-error')).toBe('That payment number is not valid. Check the country code and the number.');
    expect(everyText(root)).not.toContain('+6591234567');
  });
});
