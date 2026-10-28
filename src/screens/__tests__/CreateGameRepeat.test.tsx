/**
 * Create game: Repeat weekly (er-m-series, AD-8; A38 board of record). Checks the control on step 3, that exactly one end rule is required,
 * the exact request fields, no bound kept on the device, and the labelled server refusals (never the server text).
 */
import React from 'react';

import { getClientConfig, getGameLimits } from '../../api/config';
import { createEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getCountryCodes, getOwnMobileNumber } from '../../api/mobileNumber';
import { getSports } from '../../api/sports';
import { searchUsers } from '../../api/users';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGameScreen from '../CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../api/config', () => ({ getClientConfig: jest.fn(), getGameLimits: jest.fn() }));
jest.mock('../../api/mobileNumber', () => ({ getCountryCodes: jest.fn(), getOwnMobileNumber: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const mockCreateEvent = createEvent as jest.Mock;

async function mount(): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([{ name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue([]);
  (getGameLimits as jest.Mock).mockResolvedValue({ players_min: 2, players_max: 100 });
  (getClientConfig as jest.Mock).mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false });
  (getCountryCodes as jest.Mock).mockResolvedValue([]);
  (getOwnMobileNumber as jest.Mock).mockResolvedValue(null);
  mockCreateEvent.mockReset().mockResolvedValue({ id: 'evt-1' });
  const props = { navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const use = (root: Instance, id: string, prop: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && typeof n.props[prop] === 'function')[0];
  if (!found) throw new Error(`nothing to use: ${id}`);
  return found;
};
const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};
const all = (root: Instance): string => texts(root).join(' | ');

async function toStep3(root: Instance): Promise<void> {
  await press(byLabel(root, 'Next'));
  await act(async () => {
    root.find(n => (n.type as unknown) === 'TextInput' && /e\.g\./.test(String(n.props.placeholder))).props.onChangeText('Friday');
  });
  await press(byLabel(root, 'Next'));
}
const turnOn = async (root: Instance): Promise<void> => {
  await act(async () => use(root, 'repeat-toggle', 'onValueChange').props.onValueChange(true));
};
const chooseEnd = async (root: Instance, label: string): Promise<void> => press(byLabel(root, label));
const type = async (root: Instance, id: string, value: string): Promise<void> => {
  await act(async () => use(root, id, 'onChangeText').props.onChangeText(value));
};
async function toStep6(root: Instance): Promise<void> {
  for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
}

describe('Repeat weekly on step 3', () => {
  it('is off by default, shows the interval, the read-only weekday, the end choice and the first-game invitation copy when on', async () => {
    const root = await mount();
    await toStep3(root);
    expect(all(byId(root, 'repeat-weekly')[0])).toContain('Repeat weekly');
    expect(byId(root, 'repeat-every')).toHaveLength(0);
    await turnOn(root);
    expect(use(root, 'repeat-every', 'onChangeText').props.value).toBe('1');
    expect(all(byId(root, 'repeat-weekday')[0])).toMatch(/On \w+, the weekday of the first game\./);
    expect(all(byId(root, 'repeat-weekly')[0])).toContain('After a number of games');
    expect(all(byId(root, 'repeat-weekly')[0])).toContain('On a date');
    expect(all(byId(root, 'repeat-invite-note')[0])).toBe('Invitations go to the first game. Each person accepts once and joins the whole series.');
  });

  it('refuses Next until exactly one end rule is chosen and filled, with its label', async () => {
    const root = await mount();
    await toStep3(root);
    await turnOn(root);
    await press(byLabel(root, 'Next'));
    expect(all(byId(root, 'repeat-error')[0])).toContain('Choose how the series ends');
    await chooseEnd(root, 'After a number of games');
    await press(byLabel(root, 'Next'));
    expect(all(byId(root, 'repeat-error')[0])).toContain('Choose how the series ends');
    await type(root, 'repeat-every', '0');
    await press(byLabel(root, 'Next'));
    expect(all(byId(root, 'repeat-error')[0])).toContain('Enter a whole number of weeks, 1 or more.');
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('sends weekly, the interval and the number of games only; a large count is not stopped on the device', async () => {
    const root = await mount();
    await toStep3(root);
    await turnOn(root);
    await type(root, 'repeat-every', '2');
    await chooseEnd(root, 'After a number of games');
    await type(root, 'repeat-count', '500');
    await toStep6(root);
    expect(all(byId(root, 'review-repeat')[0])).toBe('Repeats every 2 weeks, ends after 500 games');
    await press(byLabel(root, 'Create Game'));
    const body = mockCreateEvent.mock.calls[0][0];
    expect(body).toMatchObject({ recurrence_frequency: 'weekly', recurrence_interval: 2, recurrence_occurrence_limit: 500 });
    expect(body).not.toHaveProperty('recurrence_ends_on');
    expect(body).not.toHaveProperty('recurrence_day_of_week');
  });

  it('sends the end date instead when "On a date" is chosen, never both', async () => {
    const root = await mount();
    await toStep3(root);
    await turnOn(root);
    await chooseEnd(root, 'On a date');
    await act(async () => use(root, 'repeat-end-date', 'onChange').props.onChange('2099-03-01'));
    await toStep6(root);
    await press(byLabel(root, 'Create Game'));
    const body = mockCreateEvent.mock.calls[0][0];
    expect(body).toMatchObject({ recurrence_frequency: 'weekly', recurrence_interval: 1, recurrence_ends_on: '2099-03-01' });
    expect(body).not.toHaveProperty('recurrence_occurrence_limit');
  });

  it('a game without Repeat weekly sends no recurrence field', async () => {
    const root = await mount();
    await toStep3(root);
    await toStep6(root);
    await press(byLabel(root, 'Create Game'));
    expect(Object.keys(mockCreateEvent.mock.calls[0][0]).filter(k => k.startsWith('recurrence'))).toEqual([]);
  });

  it.each([
    ['SERIES_LIMIT_EXCEEDED', 'This series is longer than allowed.'],
    ['SERIES_END_INVALID', 'Choose either an end date or a number of games'],
  ])('%s shows its labelled message on step 3, never the server text', async (code, expected) => {
    const root = await mount();
    await toStep3(root);
    await turnOn(root);
    await chooseEnd(root, 'After a number of games');
    await type(root, 'repeat-count', '99');
    await toStep6(root);
    mockCreateEvent.mockRejectedValueOnce({ response: { status: 422, data: { code, detail: 'raw server text' } } });
    await press(byLabel(root, 'Create Game'));
    const text = all(byId(root, 'repeat-error')[0]);
    expect(text).toContain(expected);
    expect(all(root)).not.toContain('raw server text');
  });
});
