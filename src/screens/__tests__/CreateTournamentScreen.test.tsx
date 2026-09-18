/**
 * Create Tournament form against the live `TournamentCreate` contract:
 * field names, limits and the "no default => user must choose" rule for
 * sport and participation_mode. API and navigation mocked.
 */
import React from 'react';

import { getSports } from '../../api/sports';
import { createTournament } from '../../api/tournaments';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateTournamentScreen from '../CreateTournamentScreen';

type Props = React.ComponentProps<typeof CreateTournamentScreen>;

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockCreateTournament = createTournament as jest.MockedFunction<typeof createTournament>;
const popTo = jest.fn();

const SPORTS = [
  { name: 'badminton', display_name: 'Badminton' },
  { name: 'football', display_name: 'Football' },
];

async function mount(): Promise<Instance> {
  const props = { navigation: { popTo }, route: { params: undefined } };
  return renderAsync(<CreateTournamentScreen {...(props as unknown as Props)} />);
}

const input = (root: Instance, placeholder: string): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === placeholder);
const capacityInput = (root: Instance): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.keyboardType === 'number-pad');
const type = (field: Instance, value: string): void => {
  act(() => {
    field.props.onChangeText(value);
  });
};
const choose = (root: Instance, label: string): void => {
  act(() => {
    pressableLabelled(root, label).props.onPress();
  });
};
const submit = async (root: Instance): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, 'Create Tournament').props.onPress();
  });
};
const START = 'YYYY-MM-DD HH:mm';

/** Fills every required field with valid values. */
function fillValid(root: Instance): void {
  type(input(root, 'e.g. Summer Cup'), '  Summer Cup ');
  choose(root, 'Football');
  choose(root, 'Team');
  type(capacityInput(root), '16');
  type(root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === START)[0], '2026-10-01 18:30');
}

beforeEach(() => {
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockCreateTournament.mockReset();
  popTo.mockReset();
});

describe('CreateTournamentScreen — form contract', () => {
  it('lists the sports from the backend and the documented format / participation values', async () => {
    const root = await mount();
    for (const label of ['Badminton', 'Football', 'Individual', 'Team', 'Knockout', 'Round robin', 'Group stage']) {
      expect(pressableLabelled(root, label)).toBeDefined();
    }
  });

  it('pre-fills only what the schema defaults: format=knockout, capacity=8; sport and participation start unchosen', async () => {
    const root = await mount();
    expect(pressableLabelled(root, 'Knockout').props.accessibilityState.selected).toBe(true);
    expect(capacityInput(root).props.value).toBe('8');
    for (const label of ['Badminton', 'Football', 'Individual', 'Team']) {
      expect(pressableLabelled(root, label).props.accessibilityState.selected).toBe(false);
    }
  });

  it('caps title at the schema maximum of 150', async () => {
    const root = await mount();
    expect(input(root, 'e.g. Summer Cup').props.maxLength).toBe(150);
  });
});

describe('CreateTournamentScreen — validation (no API call on failure)', () => {
  const cases: Array<[string, (root: Instance) => void, string]> = [
    ['blank title', root => { choose(root, 'Football'); choose(root, 'Team'); }, 'Enter a tournament title.'],
    ['no sport', root => { type(input(root, 'e.g. Summer Cup'), 'Cup'); choose(root, 'Team'); }, 'Choose a sport.'],
    ['no participation mode', root => { type(input(root, 'e.g. Summer Cup'), 'Cup'); choose(root, 'Football'); }, 'Choose individual or team participation.'],
  ];

  it.each(cases)('%s', async (_name, setup, message) => {
    const root = await mount();
    setup(root);
    await submit(root);
    expect(texts(root)).toContain(message);
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  it.each(['1', '0', '', '2.5', 'abc', '-3'])('rejects capacity %p (schema: integer > 1)', async value => {
    const root = await mount();
    fillValid(root);
    type(capacityInput(root), value);
    await submit(root);
    expect(texts(root)).toContain('Capacity must be a whole number of at least 2.');
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed start, and a malformed (non-empty) registration close', async () => {
    const root = await mount();
    fillValid(root);
    const [start, close] = root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === START);

    type(start, '');
    await submit(root);
    expect(texts(root)).toContain('Enter the start as YYYY-MM-DD HH:mm.');

    type(start, '2026-10-01 18:30');
    type(close, 'soon');
    await submit(root);
    expect(texts(root)).toContain('Enter the registration close as YYYY-MM-DD HH:mm, or leave it empty.');
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });
});

describe('CreateTournamentScreen — submit', () => {
  it('sends the exact TournamentCreate payload (trimmed title, sport name, ISO start) and pops back with a refresh key', async () => {
    mockCreateTournament.mockResolvedValueOnce({} as never);
    const root = await mount();
    fillValid(root);
    choose(root, 'Round robin');
    await submit(root);

    expect(mockCreateTournament).toHaveBeenCalledTimes(1);
    expect(mockCreateTournament).toHaveBeenCalledWith(
      {
        title: 'Summer Cup',
        sport: 'football',
        participation_mode: 'team',
        format: 'round_robin',
        capacity: 16,
        starts_at: new Date(2026, 9, 1, 18, 30).toISOString(),
      },
      { correlationId: expect.any(String) },
    );
    expect(popTo).toHaveBeenCalledWith('TournamentsList', { refreshKey: expect.any(Number) });
  });

  it('omits registration_closes_at when blank and includes it as ISO when given', async () => {
    mockCreateTournament.mockResolvedValue({} as never);
    const root = await mount();
    fillValid(root);
    await submit(root);
    expect(mockCreateTournament.mock.calls[0][0]).not.toHaveProperty('registration_closes_at');

    const [, close] = root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === START);
    type(close, '2026-09-30 12:00');
    await submit(root);
    expect(mockCreateTournament.mock.calls[1][0]).toHaveProperty(
      'registration_closes_at',
      new Date(2026, 8, 30, 12, 0).toISOString(),
    );
  });

  it('shows the backend validation message inline on a 422 and stays on the form', async () => {
    mockCreateTournament.mockRejectedValueOnce({
      response: { status: 422, data: { detail: [{ loc: ['body', 'starts_at'], msg: 'Must be in the future', type: 'x' }] } },
    });
    const root = await mount();
    fillValid(root);
    await submit(root);
    expect(texts(root)).toContain('starts at: Must be in the future');
    expect(popTo).not.toHaveBeenCalled();
  });

  it('shows a generic message on a network failure', async () => {
    mockCreateTournament.mockRejectedValueOnce(new Error('Network Error'));
    const root = await mount();
    fillValid(root);
    await submit(root);
    expect(texts(root)).toContain('Could not create the tournament. Please try again.');
  });

  it('locks the form while in flight', async () => {
    let resolve!: () => void;
    mockCreateTournament.mockReturnValueOnce(new Promise(r => { resolve = () => r({} as never); }));
    const root = await mount();
    fillValid(root);
    await submit(root);
    expect(pressableLabelled(root, 'Football').props.disabled).toBe(true);
    expect(capacityInput(root).props.editable).toBe(false);
    await act(async () => resolve());
    expect(popTo).toHaveBeenCalledTimes(1);
  });
});

describe('CreateTournamentScreen — sports loading', () => {
  it('shows an error with retry when sports cannot be loaded, and recovers on retry', async () => {
    mockGetSports.mockReset().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(SPORTS);
    const root = await mount();
    expect(texts(root)).toContain('Could not load the list of sports. Please try again.');

    await act(async () => {
      root.find(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function').props.onPress();
    });
    expect(pressableLabelled(root, 'Football')).toBeDefined();
  });

  it('says so, rather than showing an empty picker, when there are no active sports', async () => {
    mockGetSports.mockReset().mockResolvedValue([]);
    const root = await mount();
    expect(texts(root)).toContain('No sports are available right now.');
  });
});
