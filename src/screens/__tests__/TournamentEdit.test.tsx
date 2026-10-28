/**
 * Edit tournament (er-m-committee, AD-3, AD-6; ruling A38: the addendum is the board of record). The real screen and API layer run; only the
 * HTTP client, the config and sports reads and the native alert are doubles. Checks: only changed fields are sent (dates as ISO UTC), the
 * withdrawal choice starts on and rides with a start, end or venue change, the reset confirmation, `fixtures_reset` in the answer, and the
 * labelled messages of the server codes (never the server text).
 */
import React from 'react';
import { Alert } from 'react-native';

import TournamentEditScreen from '../TournamentEditScreen';
import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn() } }));
jest.mock('../../api/config', () => ({ getClientConfig: jest.fn().mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false }) }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn().mockResolvedValue([]) }));

const get = apiClient.get as jest.Mock;
const patch = apiClient.patch as jest.Mock;
const goBack = jest.fn();

const pad = (n: number): string => String(n).padStart(2, '0');
const local = (days: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour)}:00`;
};
const iso = (days: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const rawTournament = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 't-1',
  organizer_id: 'organiser-1',
  sport: 'badminton',
  title: 'Punggol Open',
  name: null,
  description: 'A cup',
  format: 'knockout',
  capacity: 32,
  registration_closes_at: iso(10, 12),
  registration_hard_block_at: iso(12, 12),
  starts_at: iso(20, 9),
  ends_at: iso(20, 18),
  status: 'upcoming',
  lifecycle_version: 2,
  venue_name: 'Punggol Hall',
  venue_address: '1 Punggol Way',
  created_at: '2026-09-01T10:00:00Z',
  ...over,
});

async function mount(tournament: Record<string, unknown> = {}): Promise<Instance> {
  get.mockReset().mockResolvedValue({ data: rawTournament(tournament) });
  patch.mockReset().mockResolvedValue({ data: { fixtures_reset: false } });
  goBack.mockReset();
  const props = { route: { key: 'k', name: 'TournamentEdit', params: { tournamentId: 't-1' } }, navigation: { goBack } } as unknown as React.ComponentProps<typeof TournamentEditScreen>;
  return renderAsync(<TournamentEditScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const find = (root: Instance, id: string, prop: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && typeof n.props[prop] === 'function')[0];
  if (!found) throw new Error(`nothing to use: ${id}`);
  return found;
};
const setDate = async (root: Instance, id: string, value: string): Promise<void> => {
  await act(async () => find(root, id, 'onChange').props.onChange(value));
};
const type = async (root: Instance, id: string, value: string): Promise<void> => {
  await act(async () => find(root, id, 'onChangeText').props.onChangeText(value));
};
const press = async (root: Instance, id: string): Promise<void> => {
  await act(async () => find(root, id, 'onPress').props.onPress());
};
const everyText = (root: Instance): string => texts(root).join(' | ');
const alertPress = async (label: string): Promise<void> => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as { text: string; onPress?: () => void }[];
  const button = buttons.find(b => b.text === label);
  if (!button?.onPress) throw new Error(`no alert button ${label}`);
  await act(async () => {
    await button.onPress?.();
  });
};

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('Edit tournament', () => {
  it('shows the stored values, the hard block field, and a withdrawal choice that starts on; Save waits for a change', async () => {
    const root = await mount();
    expect(find(root, 'edit-title', 'onChangeText').props.value).toBe('Punggol Open');
    expect(find(root, 'edit-starts', 'onChange').props.value).toBe(local(20, 9));
    expect(byId(root, 'edit-hard-block').length).toBeGreaterThan(0);
    expect(find(root, 'edit-may-withdraw', 'onValueChange').props.value).toBe(true);
    expect(find(root, 'edit-save', 'onPress').props.disabled).toBe(true);
    expect(everyText(root)).toContain('Visible to the organizer and the committee only.');
  });

  it('sends only the changed fields: a title edit sends the title alone, and no withdrawal flag', async () => {
    const root = await mount();
    await type(root, 'edit-title', 'Punggol Open 2027');
    await press(root, 'edit-save');
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][0]).toBe('/tournaments/t-1');
    expect(patch.mock.calls[0][1]).toEqual({ title: 'Punggol Open 2027' });
    expect(patch.mock.calls[0][2].correlationId).toEqual(expect.any(String));
    expect(goBack).not.toHaveBeenCalled();
    await alertPress('Done');
    expect(goBack).toHaveBeenCalled();
  });

  it('a start change sends ISO UTC and the withdrawal choice with it; switching the choice off is sent as false', async () => {
    const root = await mount();
    await setDate(root, 'edit-starts', local(25, 10));
    await act(async () => find(root, 'edit-may-withdraw', 'onValueChange').props.onValueChange(false));
    await press(root, 'edit-save');
    const body = patch.mock.calls[0][1];
    expect(Object.keys(body).sort()).toEqual(['registrants_may_withdraw', 'starts_at']);
    expect(body.starts_at).toBe(new Date(local(25, 10).replace(' ', 'T') + ':00').toISOString());
    expect(body.registrants_may_withdraw).toBe(false);
  });

  it('a changed date in the past is stopped on the screen (UX hint) and nothing is sent', async () => {
    const root = await mount();
    await setDate(root, 'edit-closes', local(-1, 9));
    await press(root, 'edit-save');
    expect(patch).not.toHaveBeenCalled();
    expect(everyText(root)).toContain('Dates you change must be in the future.');
  });

  it('asks before a change that resets fixtures, and says so when the server reset them', async () => {
    const root = await mount({ status: 'schedule_draft' });
    await setDate(root, 'edit-starts', local(25, 10));
    patch.mockResolvedValue({ data: { fixtures_reset: true } });
    await press(root, 'edit-save');
    expect(patch).not.toHaveBeenCalled();
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toContain('Fixtures have already been generated.');
    await alertPress('Save');
    expect(patch).toHaveBeenCalledTimes(1);
    expect((Alert.alert as jest.Mock).mock.calls[1][1]).toBe('Saved. The fixtures were reset: generate them again.');
  });

  it('a title-only change with fixtures needs no reset confirmation', async () => {
    const root = await mount({ status: 'published' });
    await type(root, 'edit-title', 'New name');
    await press(root, 'edit-save');
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['REGISTRATION_DATES_REQUIRED', {}, 'Set a new registration closing date in the future'],
    ['TOURNAMENT_HAS_RESULTS', {}, 'A result has been recorded, so the dates and venue can no longer be changed.'],
    ['TOURNAMENT_STARTED', {}, 'This tournament has started, so its dates and venue can no longer be changed.'],
  ])('%s shows its labelled message, not the server text', async (code, extra, expected) => {
    const root = await mount();
    await type(root, 'edit-title', 'X');
    patch.mockRejectedValue({ response: { status: 409, data: { code, detail: 'raw server text', ...extra } } });
    await press(root, 'edit-save');
    const all = everyText(byId(root, 'edit-error')[0]);
    expect(all).toContain(expected);
    expect(all).not.toContain('raw server text');
  });

  it('TOURNAMENT_DATES_INVALID uses its reason: DATE_IN_PAST on the closing date reads as the past-date message', async () => {
    const root = await mount();
    await type(root, 'edit-title', 'X');
    patch.mockRejectedValue({ response: { status: 422, data: { code: 'TOURNAMENT_DATES_INVALID', reason: 'DATE_IN_PAST', field: 'registration_closes_at', detail: 'raw' } } });
    await press(root, 'edit-save');
    expect(everyText(byId(root, 'edit-error')[0])).toContain('This date has already passed.');
    expect(everyText(byId(root, 'edit-error')[0])).not.toContain('raw');
  });

  it('the fee PATCH client is unchanged: it still sends the fee fields only', async () => {
    const { updateTournamentFee } = jest.requireActual('../../api/tournaments');
    patch.mockReset().mockResolvedValue({ data: {} });
    await updateTournamentFee('t-1', 2500, { paymentContactNumber: '+6591234567' });
    expect(patch).toHaveBeenCalledWith('/tournaments/t-1', { registration_fee_cents: 2500, payment_contact_number: '+6591234567' }, { correlationId: undefined });
  });
});
