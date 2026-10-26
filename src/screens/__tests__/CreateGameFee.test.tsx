/** Create game fee (teams-payments AD-8, AD-7): the fee field and the payee number show only while the client-config switch is on. */
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
const COUNTRIES = [{ iso2: 'SG', name: 'Singapore', dial_code: '+65', sort_order: 1, enabled: true }];
const ON = { google_maps_api_key: null, venue_catalogue_enabled: false, game_fee_enabled: true, game_fee_currency: 'SGD', game_fee_max_cents: 100000 };
const OFF = { ...ON, game_fee_enabled: false };

async function mount(config: Record<string, unknown>, ownNumber: string | null = '+6591234567'): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([{ name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue([]);
  (getGameLimits as jest.Mock).mockResolvedValue({ players_min: 2, players_max: 100 });
  (getClientConfig as jest.Mock).mockResolvedValue(config);
  (getCountryCodes as jest.Mock).mockResolvedValue(COUNTRIES);
  (getOwnMobileNumber as jest.Mock).mockResolvedValue(ownNumber);
  mockCreateEvent.mockReset().mockResolvedValue({ id: 'evt-1' });
  const props = { navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');

async function toStep5(root: Instance): Promise<void> {
  await press(byLabel(root, 'Next'));
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === undefined && /e\.g\./.test(String(n.props.placeholder)))
      .props.onChangeText('Friday');
  });
  for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
}
const typeFee = async (root: Instance, value: string): Promise<void> => {
  await act(async () => {
    byId(root, 'game-fee-input')[0].props.onChangeText(value);
  });
};

describe('switch off', () => {
  it('shows no fee field and sends no fee', async () => {
    const root = await mount(OFF);
    await toStep5(root);
    expect(byId(root, 'game-fee-fields')).toHaveLength(0);
    await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent.mock.calls[0][0]).not.toHaveProperty('registration_fee_cents');
    expect(mockCreateEvent.mock.calls[0][0]).not.toHaveProperty('payment_contact_number');
  });
});

describe('switch on', () => {
  it('shows an optional fee field; empty is a free game with no fee or number sent', async () => {
    const root = await mount(ON);
    await toStep5(root);
    expect(byId(root, 'game-fee-fields')).toHaveLength(1);
    expect(texts(root)).toContain('Game fee (optional)');
    expect(byId(root, 'game-fee-payee')).toHaveLength(0);
    await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent.mock.calls[0][0]).not.toHaveProperty('registration_fee_cents');
  });

  it('a fee shows the payee number prefilled from the profile, and both are sent (E.164, whole cents)', async () => {
    const root = await mount(ON);
    await toStep5(root);
    await typeFee(root, '5');
    expect(byId(root, 'game-fee-payee')).toHaveLength(1);
    expect(texts(root)).toEqual(expect.arrayContaining(['PayNow / PayLah number', 'Shown to people who join this game.']));
    await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent.mock.calls[0][0]).toMatchObject({ registration_fee_cents: 500, payment_contact_number: '+6591234567' });
  });

  it('a fee with no number (none on the profile) does not go on: the server label shows under the number', async () => {
    const root = await mount(ON, null);
    await toStep5(root);
    await typeFee(root, '5');
    await press(byLabel(root, 'Next'));
    expect(texts(root)).toContain('Enter a payment number: this tournament or game has a fee.');
    expect(texts(root)).not.toContain('Review');
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('an amount over the server cap is refused under the field and blocks Next', async () => {
    const root = await mount(ON);
    await toStep5(root);
    await typeFee(root, '1000.01');
    expect(byId(root, 'game-fee-error')).toHaveLength(1);
    expect(texts(root).join(' ')).toMatch(/Enter an amount between 0 and .*1,?000\.00/);
  });
});
