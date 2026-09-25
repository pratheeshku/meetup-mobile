/**
 * Create Game — merged Casual Game/Tournament screen (Create Flow
 * Amendment, DES-MEETUP-MOBILE.md §4.3, architect-approved 2026-09-22).
 * Field names/limits/enum values checked against the live `EventCreate`/
 * `TournamentCreate` contracts (see `CreateEventInput`/`CreateTournamentInput`
 * type comments for the exact source). API and navigation mocked.
 */
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { createEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament } from '../../api/tournaments';
import { colors, getSportColor } from '../../theme/tokens';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGameScreen from '../CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;
const mockCreateEvent = createEvent as jest.MockedFunction<typeof createEvent>;
const mockCreateTournament = createTournament as jest.MockedFunction<typeof createTournament>;
const popTo = jest.fn();
const navigate = jest.fn();

const SPORTS = [
  { name: 'badminton', display_name: 'Badminton' },
  { name: 'football', display_name: 'Football' },
];
const GROUPS = {
  items: [{ id: 'g-1', name: 'Sunday Footballers', description: '', owner_id: 'me', created_at: '', current_user_role: 'owner' as const }],
  total: 1,
  page: 1,
  page_size: 1,
};

async function mount(): Promise<Instance> {
  const props = { navigation: { popTo, navigate }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

const input = (root: Instance, placeholder: string): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === placeholder);
const capacityInput = (root: Instance): Instance =>
  root.findAll(node => (node.type as unknown) === 'TextInput' && node.props.keyboardType === 'number-pad')[0];
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
const pickDateTime = (root: Instance, testID: string, date: Date): void => {
  act(() => {
    const trigger = root.find(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    );
    trigger.props.onPress();
  });
  act(() => {
    const picker = root.find(n => n.props.testID === `${testID}-picker`);
    picker.props.onChange({ type: 'set' }, date);
  });
  act(() => {
    const doneButtons = root.findAll(
      n => n.props.accessibilityLabel === 'Done' && typeof n.props.onPress === 'function',
    );
    if (doneButtons.length > 0) {
      doneButtons[0].props.onPress();
    }
  });
};

beforeEach(() => {
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetMyGroups.mockReset().mockResolvedValue(GROUPS);
  mockCreateEvent.mockReset();
  mockCreateTournament.mockReset();
  popTo.mockReset();
  navigate.mockReset();
});

describe('CreateGameScreen — toggle', () => {
  it('defaults to Casual Game and offers a Tournament toggle', async () => {
    const root = await mount();
    expect(pressableLabelled(root, '🎮 Casual Game').props.accessibilityState.selected).toBe(true);
    expect(pressableLabelled(root, '🏆 Tournament').props.accessibilityState.selected).toBe(false);
    expect(texts(root)).toContain('Create Game');
  });

  it('switching to Tournament shows the tournament form and hides the casual one, without losing typed casual values', async () => {
    const root = await mount();
    type(input(root, 'e.g. Sunday 5-a-side Football'), 'Friday Futsal');
    choose(root, '🏆 Tournament');

    expect(() => input(root, 'e.g. Sunday 5-a-side Football')).toThrow();
    expect(pressableLabelled(root, 'Create Tournament')).toBeDefined();

    choose(root, '🎮 Casual Game');
    expect(input(root, 'e.g. Sunday 5-a-side Football').props.value).toBe('Friday Futsal');
  });
});

describe('CreateGameScreen — Casual Game form contract', () => {
  it('offers the amended field set with public visibility and all-levels skill pre-selected', async () => {
    const root = await mount();
    for (const label of ['Title', 'Sport', 'Visibility', 'Skill Level', 'Capacity', 'Venue Name', 'Venue Address', 'Description']) {
      expect(texts(root)).toContain(label);
    }
    expect(pressableLabelled(root, '🌍 Public').props.accessibilityState.selected).toBe(true);
    expect(pressableLabelled(root, 'All Levels').props.accessibilityState.selected).toBe(true);
  });

  it('shows the conditional Group picker only when Visibility = Group', async () => {
    const root = await mount();
    expect(texts(root)).not.toContain('Group');
    choose(root, '👥 Group');
    expect(pressableLabelled(root, 'Group')).toBeDefined();
    choose(root, 'Group');
    expect(pressableLabelled(root, 'Sunday Footballers')).toBeDefined();
  });

  it('rejects submit with Visibility = Group and no group chosen', async () => {
    const root = await mount();
    type(input(root, 'e.g. Sunday 5-a-side Football'), 'Futsal');
    type(capacityInput(root), '10');
    pickDateTime(root, 'casual-start-date-time', new Date(2026, 9, 1, 18, 30));
    choose(root, '👥 Group');
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    expect(texts(root)).toContain('Choose a group.');
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['blank title', (root: Instance) => { type(capacityInput(root), '10'); }, 'Enter a game title.'],
  ])('%s', async (_name, setup, message) => {
    const root = await mount();
    setup(root);
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    expect(texts(root)).toContain(message);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it.each(['1', '201', '', 'abc'])('rejects capacity %p (2–200, matching web)', async value => {
    const root = await mount();
    type(input(root, 'e.g. Sunday 5-a-side Football'), 'Futsal');
    type(capacityInput(root), value);
    pickDateTime(root, 'casual-start-date-time', new Date(2026, 9, 1, 18, 30));
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    expect(texts(root)).toContain('Capacity must be a whole number between 2 and 200.');
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('fills the date portion of Start Date & Time from the quick-select chips, keeping any selected time', async () => {
    const root = await mount();
    pickDateTime(root, 'casual-start-date-time', new Date(2000, 0, 1, 20, 15));
    choose(root, 'Today');
    const trigger = root.find(n => n.props.testID === 'casual-start-date-time');
    const text = texts(trigger).join('');
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2} 20:15$/);
    expect(text.endsWith('20:15')).toBe(true);
  });
});

describe('CreateGameScreen — Casual Game submit', () => {
  function fillValid(root: Instance): void {
    type(input(root, 'e.g. Sunday 5-a-side Football'), '  Friday Futsal ');
    type(capacityInput(root), '10');
    pickDateTime(root, 'casual-start-date-time', new Date(2026, 9, 1, 18, 30));
  }

  it('sends the minimal EventCreate payload (no sport chosen, defaults, ends_at null) and pops back with a refresh key', async () => {
    mockCreateEvent.mockResolvedValueOnce({} as never);
    const root = await mount();
    fillValid(root);
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());

    expect(mockCreateEvent).toHaveBeenCalledWith(
      {
        title: 'Friday Futsal',
        visibility: 'public',
        skill_level_requirement: 'all_levels',
        capacity: 10,
        starts_at: new Date(2026, 9, 1, 18, 30).toISOString(),
        ends_at: null,
      },
      { correlationId: expect.any(String) },
    );
    expect(popTo).toHaveBeenCalledWith('EventsList', { refreshKey: expect.any(Number) });
  });

  it('includes sport, skill level, venue, description and group_id when set', async () => {
    mockCreateEvent.mockResolvedValueOnce({} as never);
    const root = await mount();
    fillValid(root);
    choose(root, 'Football');
    choose(root, 'Beginner');
    choose(root, '👥 Group');
    choose(root, 'Group');
    choose(root, 'Sunday Footballers');
    type(input(root, 'e.g. Bishan Sports Hall'), 'Bishan Sports Hall');
    type(input(root, 'e.g. 5 Bishan St 14, Singapore'), '5 Bishan St 14');
    type(input(root, 'Optional description...'), 'Bring your own bib');
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'football',
        skill_level_requirement: 'beginner',
        visibility: 'group',
        group_id: 'g-1',
        venue_name: 'Bishan Sports Hall',
        venue_address: '5 Bishan St 14',
        description: 'Bring your own bib',
      }),
      { correlationId: expect.any(String) },
    );
  });

  it('shows the backend validation message inline on a 422 and stays on the form', async () => {
    mockCreateEvent.mockRejectedValueOnce({
      response: { status: 422, data: { detail: [{ loc: ['body', 'visibility'], msg: 'invalid', type: 'x' }] } },
    });
    const root = await mount();
    fillValid(root);
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    expect(texts(root)).toContain('visibility: invalid');
    expect(popTo).not.toHaveBeenCalled();
  });
});

describe('CreateGameScreen — cost and currency (kept and restyled, EventCreate.estimated_cost_cents/currency)', () => {
  function fillValid(root: Instance): void {
    type(input(root, 'e.g. Sunday 5-a-side Football'), 'Friday Futsal');
    type(capacityInput(root), '10');
    pickDateTime(root, 'casual-start-date-time', new Date(2026, 9, 1, 18, 30));
  }

  it('omits cost/currency from the payload when left blank', async () => {
    mockCreateEvent.mockResolvedValueOnce({} as never);
    const root = await mount();
    fillValid(root);
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    const [payload] = mockCreateEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('estimated_cost_cents');
    expect(payload).not.toHaveProperty('estimated_cost_currency');
  });

  it('converts a typed cost to integer cents and uppercases the currency code', async () => {
    mockCreateEvent.mockResolvedValueOnce({} as never);
    const root = await mount();
    fillValid(root);
    type(input(root, 'e.g. 15.00'), '12.5');
    type(input(root, 'USD'), 'sgd');
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_cost_cents: 1250, estimated_cost_currency: 'SGD' }),
      { correlationId: expect.any(String) },
    );
  });

  it('rejects a negative or non-numeric cost', async () => {
    const root = await mount();
    fillValid(root);
    type(input(root, 'e.g. 15.00'), '-5');
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    expect(texts(root)).toContain('Estimated cost must be a non-negative number.');
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('rejects a currency code that is not exactly 3 letters', async () => {
    const root = await mount();
    fillValid(root);
    type(input(root, 'USD'), 'US');
    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());
    expect(texts(root)).toContain('Currency code must be 3 letters (e.g. USD, SGD).');
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });
});

describe('CreateGameScreen — chip colors and CTA styling', () => {
  function chipBackground(node: Instance): string | undefined {
    const view = node.findAll(n => (n.type as unknown) === 'View')[0];
    return StyleSheet.flatten(view.props.style)?.backgroundColor as string | undefined;
  }

  it("Sport chip selected state uses that sport's own color, not a neutral or the default primary", async () => {
    const root = await mount();
    choose(root, 'Football');
    expect(chipBackground(pressableLabelled(root, 'Football'))).toBe(getSportColor('football'));
  });

  it('Skill Level and Visibility chips use the neutral #1B1918 selected color, not the sport color or default primary', async () => {
    const root = await mount();
    expect(chipBackground(pressableLabelled(root, 'All Levels'))).toBe(colors.textPrimary);
    expect(chipBackground(pressableLabelled(root, '🌍 Public'))).toBe(colors.textPrimary);
  });

  it('the Create Game CTA uses the standing-rule blue (#1D5FA3), not the app-wide primary blue', async () => {
    const root = await mount();
    const button = pressableLabelled(root, 'Create Game');
    const view = button.findAll(n => (n.type as unknown) === 'View')[0];
    expect(StyleSheet.flatten(view.props.style)?.backgroundColor).toBe(colors.ctaBlue);
  });

  it('the Create Tournament CTA uses the standing-rule blue (#1D5FA3) too', async () => {
    const root = await mount();
    choose(root, '🏆 Tournament');
    const button = pressableLabelled(root, 'Create Tournament');
    const view = button.findAll(n => (n.type as unknown) === 'View')[0];
    expect(StyleSheet.flatten(view.props.style)?.backgroundColor).toBe(colors.ctaBlue);
  });
});

describe('CreateGameScreen — Tournament form contract', () => {
  async function toTournament(): Promise<Instance> {
    const root = await mount();
    choose(root, '🏆 Tournament');
    return root;
  }

  it('offers the amended field set, pre-fills format=knockout and capacity=8, and excludes Group Stage', async () => {
    const root = await toTournament();
    for (const label of ['Tournament Title', 'Tournament Start Date', 'Sport', 'Visibility', 'Participation', 'Format', 'Venue Name']) {
      expect(texts(root)).toContain(label);
    }
    expect(pressableLabelled(root, 'Knockout').props.accessibilityState.selected).toBe(true);
    expect(capacityInput(root).props.value).toBe('8');
    expect(() => pressableLabelled(root, 'Group stage')).toThrow();
    expect(texts(root).some(t => /venue address/i.test(t))).toBe(false);
    expect(texts(root).some(t => /skill level/i.test(t))).toBe(false);
  });

  it('shows the conditional Group picker only when Visibility = Group Only', async () => {
    const root = await toTournament();
    choose(root, 'Group Only');
    choose(root, 'Group');
    expect(pressableLabelled(root, 'Sunday Footballers')).toBeDefined();
  });
});

describe('CreateGameScreen — Tournament submit', () => {
  async function toTournament(): Promise<Instance> {
    const root = await mount();
    choose(root, '🏆 Tournament');
    return root;
  }

  function fillValid(root: Instance): void {
    type(input(root, 'e.g. Summer League'), '  Summer Cup ');
    choose(root, 'Football');
    choose(root, 'Team');
    pickDateTime(root, 'tournament-start-date', new Date(2026, 9, 1));
  }

  it.each([
    ['blank title', (root: Instance) => { choose(root, 'Football'); choose(root, 'Team'); }, 'Enter a tournament title.'],
    ['no sport', (root: Instance) => { type(input(root, 'e.g. Summer League'), 'Cup'); choose(root, 'Team'); }, 'Choose a sport.'],
    ['no participation mode', (root: Instance) => { type(input(root, 'e.g. Summer League'), 'Cup'); choose(root, 'Football'); }, 'Choose individual or team participation.'],
  ])('%s', async (_name, setup, message) => {
    const root = await toTournament();
    setup(root);
    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());
    expect(texts(root)).toContain(message);
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  it('rejects an unselected tournament start date', async () => {
    const root = await toTournament();
    type(input(root, 'e.g. Summer League'), 'Cup');
    choose(root, 'Football');
    choose(root, 'Team');
    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());
    expect(texts(root)).toContain('Enter the tournament start date as YYYY-MM-DD.');
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  it('sends the TournamentCreate payload with public visibility default and no group_stage option available', async () => {
    mockCreateTournament.mockResolvedValueOnce({} as never);
    const root = await toTournament();
    fillValid(root);
    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());

    expect(mockCreateTournament).toHaveBeenCalledWith(
      {
        title: 'Summer Cup',
        sport: 'football',
        visibility: 'public',
        participation_mode: 'team',
        format: 'knockout',
        capacity: 8,
        starts_at: new Date(2026, 9, 1).toISOString(),
      },
      { correlationId: expect.any(String) },
    );
  });

  it('includes description, venue_name and group_id (Visibility = Group Only) when set', async () => {
    mockCreateTournament.mockResolvedValueOnce({} as never);
    const root = await toTournament();
    fillValid(root);
    type(input(root, 'Details about rules, scheduling...'), 'Bring your own ball');
    type(input(root, 'e.g. Sports Hub Court 3'), 'Sports Hub Court 3');
    choose(root, 'Group Only');
    choose(root, 'Group');
    choose(root, 'Sunday Footballers');
    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());

    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Bring your own ball',
        venue_name: 'Sports Hub Court 3',
        visibility: 'group',
        group_id: 'g-1',
      }),
      { correlationId: expect.any(String) },
    );
  });

  it('on success, navigates cross-tab to the Tournaments list with a refresh key (no local Tournaments route to popTo)', async () => {
    mockCreateTournament.mockResolvedValueOnce({} as never);
    const root = await toTournament();
    fillValid(root);
    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());

    expect(navigate).toHaveBeenCalledWith('Tournaments', {
      screen: 'TournamentsList',
      params: { refreshKey: expect.any(Number) },
    });
    expect(popTo).not.toHaveBeenCalled();
  });

  it('shows a generic message on a network failure and stays on the form', async () => {
    mockCreateTournament.mockRejectedValueOnce(new Error('Network Error'));
    const root = await toTournament();
    fillValid(root);
    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());
    expect(texts(root)).toContain('Could not create the tournament. Please try again.');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('CreateGameScreen — sports loading (shared by both modes)', () => {
  it('shows an error with retry when sports cannot be loaded, and recovers on retry', async () => {
    mockGetSports.mockReset().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(SPORTS);
    const root = await mount();
    expect(texts(root)).toContain('Could not load the list of sports. Please try again.');

    await act(async () => {
      root.find(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function').props.onPress();
    });
    expect(pressableLabelled(root, 'Football')).toBeDefined();
  });

  it('degrades gracefully (empty group list, form still usable) when groups fail to load', async () => {
    mockGetMyGroups.mockReset().mockRejectedValue(new Error('down'));
    const root = await mount();
    choose(root, '👥 Group');
    expect(texts(root)).toContain("You don't belong to any groups yet.");
  });
});

describe('CreateGameScreen — keyboard avoidance and date/time picker integration', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('wraps the form in a KeyboardAvoidingView with padding behavior on iOS', async () => {
    Platform.OS = 'ios';
    const root = await mount();
    const kav = root.find(n => n.props.behavior === 'padding');
    expect(kav).toBeDefined();
    expect(kav.props.behavior).toBe('padding');
  });

  // Regression test: this app ships Android only (CLAUDE.md), and the
  // wrapper previously set `behavior={Platform.OS === 'ios' ? 'padding' :
  // undefined}` — a no-op KeyboardAvoidingView on the one platform this
  // app actually ships to, so a focused field at the bottom of the form
  // (e.g. Description) stayed hidden behind the on-screen keyboard. The
  // previous test above never caught this because it only ever asserted
  // the iOS branch.
  it('wraps the form in a KeyboardAvoidingView with height behavior on Android (the shipped platform)', async () => {
    Platform.OS = 'android';
    const root = await mount();
    const kav = root.find(n => n.props.behavior === 'height');
    expect(kav).toBeDefined();
    expect(kav.props.behavior).toBe('height');
    expect(() => root.find(n => n.props.behavior === 'padding')).toThrow();
  });

  it('Casual Game: manual picker interaction produces the correct UTC ISO 8601 starts_at timestamp', async () => {
    mockCreateEvent.mockResolvedValueOnce({} as never);
    const root = await mount();
    type(input(root, 'e.g. Sunday 5-a-side Football'), 'Saturday Kickoff');
    type(capacityInput(root), '12');

    // Pick 2026-11-15 14:45
    pickDateTime(root, 'casual-start-date-time', new Date(2026, 10, 15, 14, 45));

    await act(async () => pressableLabelled(root, 'Create Game').props.onPress());

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Saturday Kickoff',
        starts_at: new Date(2026, 10, 15, 14, 45).toISOString(),
      }),
      { correlationId: expect.any(String) },
    );
  });

  it('Tournament: picking start date and optional registration close sends exact ISO timestamps', async () => {
    mockCreateTournament.mockResolvedValueOnce({} as never);
    const root = await mount();
    choose(root, '🏆 Tournament');
    type(input(root, 'e.g. Summer League'), 'Winter Open');
    choose(root, 'Football');
    choose(root, 'Individual');

    // Tournament start date: 2026-12-01
    pickDateTime(root, 'tournament-start-date', new Date(2026, 11, 1));
    // Registration close: 2026-11-28 20:00
    pickDateTime(root, 'tournament-reg-close', new Date(2026, 10, 28, 20, 0));

    await act(async () => pressableLabelled(root, 'Create Tournament').props.onPress());

    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Winter Open',
        starts_at: new Date(2026, 11, 1).toISOString(),
        registration_closes_at: new Date(2026, 10, 28, 20, 0).toISOString(),
      }),
      { correlationId: expect.any(String) },
    );
  });
});
