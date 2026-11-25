/**
 * Create Game wizard (DES-MEETUP-MOBILE.md §4.3 Create Flow Amendment as built
 * into the six-step wizard of design-ref-p23/Game1Type.png .. Game6Invite.png).
 * Field names/limits/enum values checked against the live `EventCreate`/
 * `TournamentCreate` contracts (see `CreateEventInput`/`CreateTournamentInput`
 * type comments for the exact source). API and navigation mocked.
 *
 * Steps: 1 What are you creating, 2 Sport and title, 3 When and where,
 * 4 Who can play, 5 Players and skill level, 6 Invite, remarks and review.
 */
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { getClientConfig, getGameLimits } from '../../api/config';
import { createEvent, inviteEmailToEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament, getWizardTemplates } from '../../api/tournaments';
import { showCompletion } from '../../navigation/showCompletion';
import { sportPalette } from '../../sports/style';
import { colors } from '../../theme/tokens';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGameScreen from '../CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn(), getGameLimits: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn(), getWizardTemplates: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;
const mockCreateEvent = createEvent as jest.MockedFunction<typeof createEvent>;
const mockInviteEmail = inviteEmailToEvent as jest.MockedFunction<typeof inviteEmailToEvent>;
const mockCreateTournament = createTournament as jest.MockedFunction<typeof createTournament>;
const mockShowCompletion = showCompletion as jest.Mock;
const popTo = jest.fn();
const navigate = jest.fn();
const goBack = jest.fn();

const SPORTS = [
  { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#2A7B72' },
  { name: 'football', display_name: 'Football', icon_key: 'football', color: '#835C2B' },
];
const GROUPS = {
  items: [{ id: 'g-1', name: 'Sunday Footballers', description: '', owner_id: 'me', created_at: '', current_user_role: 'owner' as const }],
  total: 1,
  page: 1,
  page_size: 1,
};
const NO_GROUPS = { items: [], total: 0, page: 1, page_size: 1 };

// Fixed future dates: the wizard rejects a start in the past (closure-report CR-11).
const FUTURE = new Date(2030, 9, 1, 18, 30);

async function mount(): Promise<Instance> {
  const props = { navigation: { popTo, navigate, goBack }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

const input = (root: Instance, placeholder: string): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === placeholder);
const capacityInput = (root: Instance): Instance =>
  root.findAll(node => (node.type as unknown) === 'TextInput' && node.props.keyboardType === 'number-pad')[0];
const titleInput = (root: Instance): Instance => input(root, 'e.g. Sunday 5-a-side Football');

/** First node carrying this accessibility label and an onPress (cards, pills, buttons). */
const byLabel = (root: Instance, label: string): Instance => {
  const found = root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!found) {
    throw new Error(`No pressable labelled "${label}"`);
  }
  return found;
};
/** First pressable whose subtree renders exactly this text (sport tiles, picker triggers). */
const byText = (root: Instance, text: string): Instance => {
  const found = root.findAll(n => typeof n.props.onPress === 'function' && texts(n).includes(text))[0];
  if (!found) {
    throw new Error(`No pressable with text "${text}"`);
  }
  return found;
};

const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};
const next = (root: Instance): Promise<void> => press(byLabel(root, 'Next'));
const submit = (root: Instance): Promise<void> => press(byLabel(root, 'Create Game'));
const type = (field: Instance, value: string): void => {
  act(() => {
    field.props.onChangeText(value);
  });
};
const isSelected = (node: Instance): boolean => Boolean(node.props.accessibilityState?.selected);

/** Opens the Date or Start time picker and picks `date` (the screen merges it into one start instant). */
const pick = (root: Instance, trigger: string, date: Date): void => {
  act(() => {
    byText(root, trigger).props.onPress();
  });
  act(() => {
    root.find(n => n.props.testID === 'dateTimePicker').props.onChange({ type: 'set' }, date);
  });
};
const pickDateTime = (root: Instance, date: Date): void => {
  pick(root, 'Date', date);
  pick(root, 'Start time', date);
};

/** Presses Next `count` times from wherever the wizard is. */
async function advance(root: Instance, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await next(root);
  }
}
const on = (root: Instance, heading: string): boolean => texts(root).includes(heading);

const H = {
  step1: 'What are you creating?',
  step2: 'Pick a sport',
  step3: 'When and where?',
  step4: 'Who can play?',
  step5: 'Players and skill level',
};

/** Walks a game to step 6 with a valid, future, public-or-group game of `capacity` players. */
async function fillGameToReview(root: Instance, capacity = 10): Promise<void> {
  await next(root); // 1 -> 2
  type(titleInput(root), '  Friday Futsal ');
  await next(root); // 2 -> 3
  pickDateTime(root, FUTURE);
  await next(root); // 3 -> 4
  await next(root); // 4 -> 5
  type(capacityInput(root), String(capacity));
  await next(root); // 5 -> 6
}

async function chooseTournament(root: Instance): Promise<void> {
  await press(byLabel(root, 'Tournament'));
}

beforeEach(() => {
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetMyGroups.mockReset().mockResolvedValue(GROUPS);
  (getGameLimits as jest.Mock).mockReset().mockResolvedValue({ players_min: 2, players_max: 200 });
  (getClientConfig as jest.Mock)
    .mockReset()
    .mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false, game_fee_enabled: false });
  // No published v2 wizard template: Tournament continues in this wizard (AD-20 fallback).
  (getWizardTemplates as jest.Mock).mockReset().mockRejectedValue(new Error('no templates'));
  mockCreateEvent.mockReset();
  mockInviteEmail.mockReset();
  mockCreateTournament.mockReset();
  mockShowCompletion.mockReset();
  popTo.mockReset();
  navigate.mockReset();
  goBack.mockReset();
});

describe('CreateGameScreen — step 1 type choice', () => {
  it('defaults to Game and offers a Tournament choice', async () => {
    const root = await mount();
    expect(on(root, H.step1)).toBe(true);
    expect(texts(root)).toContain('Step 1 of 6');
    expect(isSelected(byLabel(root, 'Game'))).toBe(true);
    expect(isSelected(byLabel(root, 'Tournament'))).toBe(false);
  });

  it('choosing Tournament switches the wizard to tournament mode (no duration row), without losing typed game values', async () => {
    const root = await mount();
    await next(root);
    type(titleInput(root), 'Friday Futsal');
    await press(byLabel(root, 'Back'));
    expect(on(root, H.step1)).toBe(true);

    await chooseTournament(root);
    expect(isSelected(byLabel(root, 'Tournament'))).toBe(true);
    expect(isSelected(byLabel(root, 'Game'))).toBe(false);
    await advance(root, 2); // 1 -> 2 -> 3
    expect(on(root, H.step3)).toBe(true);
    expect(texts(root)).not.toContain('Duration');

    await press(byLabel(root, 'Back'));
    await press(byLabel(root, 'Back'));
    await press(byLabel(root, 'Game'));
    await advance(root, 1);
    expect(titleInput(root).props.value).toBe('Friday Futsal');
    await next(root);
    expect(texts(root)).toContain('Duration');
  });
});

describe('CreateGameScreen — Game form contract', () => {
  it('offers the wizard field set with the first sport, public/group audience and all-levels skill pre-selected', async () => {
    const root = await mount();
    await next(root);
    expect(on(root, H.step2)).toBe(true);
    expect(texts(root)).toContain('Game title');
    expect(texts(root)).toContain('Badminton');
    expect(texts(root)).toContain('Football');
    await next(root);
    expect(on(root, H.step3)).toBe(true);
    for (const label of ['Date', 'Start time', 'Duration', 'Venue', 'Court or hall details (optional)']) {
      expect(texts(root)).toContain(label);
    }
    await next(root);
    expect(on(root, H.step4)).toBe(true);
    expect(texts(root)).toContain('Public');
    expect(texts(root)).toContain('Invite only');
    await next(root);
    expect(on(root, H.step5)).toBe(true);
    expect(isSelected(byLabel(root, 'All levels'))).toBe(true);
    await next(root);
    expect(texts(root)).toContain('Remarks (optional)');
  });

  it('starts on Public when the user belongs to no group', async () => {
    mockGetMyGroups.mockResolvedValue(NO_GROUPS);
    const root = await mount();
    await advance(root, 3);
    expect(on(root, H.step4)).toBe(true);
    expect(isSelected(byLabel(root, 'Public'))).toBe(true);
  });

  it('lists the groups on the audience step; choosing one shares with it and Public clears it', async () => {
    const root = await mount();
    await advance(root, 3);
    // The most recently active group is pre-selected (Game4Who board), so the audience is the group, not Public.
    expect(isSelected(byLabel(root, 'Public'))).toBe(false);
    expect(byLabel(root, 'Sunday Footballers').props.accessibilityState.checked).toBe(true);

    await press(byLabel(root, 'Public'));
    expect(isSelected(byLabel(root, 'Public'))).toBe(true);
    expect(byLabel(root, 'Sunday Footballers').props.accessibilityState.checked).toBe(false);

    await press(byLabel(root, 'Sunday Footballers'));
    expect(isSelected(byLabel(root, 'Public'))).toBe(false);
    expect(byLabel(root, 'Sunday Footballers').props.accessibilityState.checked).toBe(true);
  });

  it('blocks Next with Visibility = Group and no group chosen', async () => {
    const root = await mount();
    await advance(root, 3);
    await press(byLabel(root, 'Sunday Footballers')); // deselect the pre-selected group
    expect(texts(root)).toContain('Choose at least one group');
    expect(byLabel(root, 'Next').props.disabled).toBe(true);
    await next(root);
    expect(on(root, H.step4)).toBe(true);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('rejects a blank title', async () => {
    const root = await mount();
    await next(root);
    type(titleInput(root), '   ');
    await next(root);
    expect(texts(root)).toContain('Enter a game title.');
    expect(on(root, H.step2)).toBe(true);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it.each(['1', '201', '', 'abc'])('rejects capacity %p (2–200, from the game limits)', async value => {
    const root = await mount();
    await advance(root, 4);
    expect(on(root, H.step5)).toBe(true);
    type(capacityInput(root), value);
    expect(byLabel(root, 'Next').props.disabled).toBe(true);
    await next(root);
    expect(on(root, H.step5)).toBe(true);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('rejects a start time in the past', async () => {
    const root = await mount();
    await advance(root, 2);
    pickDateTime(root, new Date(2020, 0, 1, 10, 0));
    expect(texts(root)).toContain("Start time can't be in the past");
    await next(root);
    expect(on(root, H.step3)).toBe(true);
  });
});

describe('CreateGameScreen — Game submit', () => {
  it('sends the minimal EventCreate payload (first sport, defaults) and shows the completion screen', async () => {
    mockGetMyGroups.mockResolvedValue(NO_GROUPS);
    mockCreateEvent.mockResolvedValueOnce({ id: 'evt-1' } as never);
    const root = await mount();
    await fillGameToReview(root);
    await submit(root);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      {
        title: 'Friday Futsal',
        sport: 'badminton',
        visibility: 'public',
        skill_level_requirement: 'all_levels',
        description: null,
        capacity: 10,
        starts_at: FUTURE.toISOString(),
        ends_at: new Date(FUTURE.getTime() + 2 * 3_600_000).toISOString(),
        venue_name: 'Community Hall, Court 2',
        venue_address: 'Punggol, Singapore',
      },
      { correlationId: expect.any(String) },
    );
    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ flow: 'game_created', secondary: { button: 'view_game', id: 'evt-1' } }),
    );
  });

  it('includes sport, skill level, venue, remarks and group_ids when set', async () => {
    mockCreateEvent.mockResolvedValueOnce({ id: 'evt-1' } as never);
    const root = await mount();
    await next(root);
    await press(byText(root, 'Football'));
    type(titleInput(root), 'Friday Futsal');
    await next(root);
    pickDateTime(root, FUTURE);
    type(input(root, 'e.g. Court 2'), 'Court 5');
    await next(root);
    await next(root); // group Sunday Footballers is pre-selected
    await press(byLabel(root, 'Beginner'));
    await next(root);
    type(input(root, 'Anything else players should know'), 'Bring your own bib');
    await submit(root);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'football',
        skill_level_requirement: 'beginner',
        visibility: 'group',
        group_ids: ['g-1'],
        venue_name: 'Community Hall, Court 5',
        venue_address: 'Punggol, Singapore',
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
    await fillGameToReview(root);
    await submit(root);
    expect(texts(root)).toContain('visibility: invalid');
    expect(mockShowCompletion).not.toHaveBeenCalled();
    expect(byLabel(root, 'Create Game')).toBeDefined();
  });
});

describe('CreateGameScreen — chip colors and CTA styling', () => {
  function firstViewBackground(node: Instance): string | undefined {
    const view = node.findAll(n => (n.type as unknown) === 'View')[0];
    return StyleSheet.flatten(view.props.style)?.backgroundColor as string | undefined;
  }

  it("Sport tile selected state uses that sport's own color, not a neutral or the default primary", async () => {
    const root = await mount();
    await next(root);
    await press(byText(root, 'Football'));
    const palette = sportPalette('#835C2B');
    const tile = StyleSheet.flatten(byText(root, 'Football').props.style);
    expect(tile.borderColor).toBe(palette.tint);
    expect(tile.backgroundColor).toBe(palette.chip);
  });

  it('Skill level pills use the primary selected color; the unselected pills do not', async () => {
    const root = await mount();
    await advance(root, 4);
    expect(firstViewBackground(byLabel(root, 'All levels'))).toBe(colors.primary);
    expect(firstViewBackground(byLabel(root, 'Beginner'))).toBe(colors.primaryLight);
  });

  it('the Create Game CTA uses the standing-rule blue (#1D5FA3), not the app-wide primary blue', async () => {
    const root = await mount();
    await fillGameToReview(root);
    expect(firstViewBackground(byLabel(root, 'Create Game'))).toBe(colors.ctaBlue);
  });

  it('the CTA is the same standing-rule blue in tournament mode', async () => {
    const root = await mount();
    await chooseTournament(root);
    await fillGameToReview(root);
    expect(firstViewBackground(byLabel(root, 'Create Game'))).toBe(colors.ctaBlue);
  });
});

describe('CreateGameScreen — Tournament form contract', () => {
  async function toTournament(): Promise<Instance> {
    const root = await mount();
    await chooseTournament(root);
    return root;
  }

  it('shows Venue and capacity but no repeat control or venue address in tournament mode', async () => {
    const root = await toTournament();
    await advance(root, 2);
    expect(texts(root)).toContain('Venue');
    expect(texts(root).some(t => /repeat/i.test(t))).toBe(false);
    await advance(root, 2);
    expect(on(root, H.step5)).toBe(true);
    expect(capacityInput(root)).toBeDefined();
    expect(texts(root).some(t => /venue address/i.test(t))).toBe(false);
  });

  // As built (six-step wizard board, design-ref-p23 Game5Players): step 5 shows the skill picker in both modes, but
  // the v1 TournamentCreate payload carries no skill field. Supersedes the older DES §4.3 field list.
  it('shows the shared Skill level picker on step 5 but never sends a skill field for a tournament', async () => {
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await toTournament();
    await advance(root, 4);
    expect(on(root, H.step5)).toBe(true);
    expect(texts(root)).toContain('Skill level');
    await advance(root, 1);
    await submit(root);
    const [payload] = mockCreateTournament.mock.calls[0];
    expect(payload).not.toHaveProperty('skill_level_requirement');
    expect(payload).not.toHaveProperty('skill_level');
  });

  it('shares with a single group only (one group per tournament)', async () => {
    mockGetMyGroups.mockResolvedValue({
      ...GROUPS,
      items: [...GROUPS.items, { ...GROUPS.items[0], id: 'g-2', name: 'Monday Runners' }],
      total: 2,
    });
    const root = await toTournament();
    await advance(root, 3);
    await press(byLabel(root, 'Monday Runners'));
    expect(byLabel(root, 'Monday Runners').props.accessibilityState.checked).toBe(true);
    expect(byLabel(root, 'Sunday Footballers').props.accessibilityState.checked).toBe(false);
  });

  // As built: the wizard starts every mode at the same capacity (4); the organizer changes it on step 5.
  it('pre-fills the same capacity (4) in tournament mode as in game mode', async () => {
    const root = await toTournament();
    await advance(root, 4);
    expect(on(root, H.step5)).toBe(true);
    expect(capacityInput(root).props.value).toBe('4');
  });

  // As built: the v1 fallback wizard has no Participation or Format control; it always creates an individual knockout
  // (team mode and other formats live in the v2 TournamentWizard, lifecycle AD-20).
  it('shows no Participation, Format or Group stage control and sends individual knockout', async () => {
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await toTournament();
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      await next(root);
      seen.push(...texts(root));
    }
    expect(seen.some(t => /participation/i.test(t))).toBe(false);
    expect(() => byLabel(root, 'Knockout')).toThrow();
    expect(() => byLabel(root, 'Group stage')).toThrow();
    await advance(root, 1);
    await submit(root);
    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ participation_mode: 'individual', format: 'knockout' }),
      { correlationId: expect.any(String) },
    );
  });
});

describe('CreateGameScreen — Tournament submit', () => {
  async function toTournamentReview(): Promise<Instance> {
    const root = await mount();
    await chooseTournament(root);
    await fillGameToReview(root, 8);
    return root;
  }

  it('rejects a blank title', async () => {
    const root = await mount();
    await chooseTournament(root);
    await next(root);
    type(titleInput(root), '');
    await next(root);
    expect(texts(root)).toContain('Enter a game title.');
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  it('rejects a start date in the past', async () => {
    const root = await mount();
    await chooseTournament(root);
    await advance(root, 2);
    pickDateTime(root, new Date(2020, 0, 1, 10, 0));
    await next(root);
    expect(texts(root)).toContain("Start time can't be in the past");
    expect(on(root, H.step3)).toBe(true);
    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  // As built: participation is fixed to individual, so there is nothing to leave unset and no validation message.
  it('always submits a participation mode (individual) without a participation validation message', async () => {
    mockCreateTournament.mockResolvedValue({ id: 't-1' } as never);
    const root = await toTournamentReview();
    await submit(root);
    expect(texts(root)).not.toContain('Choose individual or team participation.');
    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ participation_mode: 'individual' }),
      { correlationId: expect.any(String) },
    );
  });

  it('sends the TournamentCreate payload with the default audience and no group_stage option', async () => {
    mockGetMyGroups.mockResolvedValue(NO_GROUPS);
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await toTournamentReview();
    await submit(root);

    expect(mockCreateTournament).toHaveBeenCalledWith(
      {
        title: 'Friday Futsal',
        sport: 'badminton',
        visibility: 'public',
        participation_mode: 'individual',
        format: 'knockout',
        capacity: 8,
        starts_at: expect.any(String),
        venue_name: 'Community Hall, Court 2',
      },
      { correlationId: expect.any(String) },
    );
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('includes venue_name and group_id (shared with a group) when set', async () => {
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await mount();
    await chooseTournament(root);
    await next(root);
    type(titleInput(root), 'Summer Cup');
    await next(root);
    pickDateTime(root, FUTURE);
    type(input(root, 'e.g. Court 2'), 'Court 3');
    await advance(root, 3); // group g-1 pre-selected
    await submit(root);

    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Summer Cup', venue_name: 'Community Hall, Court 3', visibility: 'group', group_id: 'g-1' }),
      { correlationId: expect.any(String) },
    );
  });

  // As built: Remarks (team-screens-remarks AD-4) is a game-only field; the v1 tournament form has no description path.
  it('shows no Remarks field in tournament mode and sends no description', async () => {
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await toTournamentReview();
    expect(() => input(root, 'Anything else players should know')).toThrow();
    await submit(root);
    const [payload] = mockCreateTournament.mock.calls[0];
    expect(payload).not.toHaveProperty('description');
  });

  it('on success, shows the tournament completion screen with a View tournament action', async () => {
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await toTournamentReview();
    await submit(root);

    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'tournament_created',
        primary: 'dashboard',
        secondary: { button: 'view_tournament', id: 't-1' },
      }),
    );
    expect(popTo).not.toHaveBeenCalled();
  });

  it('shows a generic message on a network failure and stays on the form', async () => {
    mockCreateTournament.mockRejectedValueOnce(new Error('Network Error'));
    const root = await toTournamentReview();
    await submit(root);
    expect(texts(root)).toContain('Could not create the game. Please try again.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
  });
});

describe('CreateGameScreen — sports loading (shared by both modes)', () => {
  it('shows an error with retry when sports cannot be loaded, and recovers on retry', async () => {
    mockGetSports.mockReset().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(SPORTS);
    const root = await mount();
    expect(texts(root)).toContain('Could not load the list of sports. Please try again.');

    await press(byLabel(root, 'Retry'));
    expect(texts(root)).not.toContain('Could not load the list of sports. Please try again.');
    await next(root);
    expect(texts(root)).toContain('Football');
  });

  it('degrades gracefully (no groups, form still usable on Public) when groups fail to load', async () => {
    mockGetMyGroups.mockReset().mockRejectedValue(new Error('down'));
    const root = await mount();
    await advance(root, 3);
    expect(on(root, H.step4)).toBe(true);
    expect(isSelected(byLabel(root, 'Public'))).toBe(false); // visibility stays Group until a group loads
    await press(byLabel(root, 'Public'));
    expect(isSelected(byLabel(root, 'Public'))).toBe(true);
    expect(byLabel(root, 'Next').props.disabled).toBeFalsy();
    await next(root);
    expect(on(root, H.step5)).toBe(true);
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

  // Regression test (rewritten for the shared KeyboardAwareScreen): the
  // wrapper once was a no-op on Android, so a focused field at the bottom of
  // the form stayed hidden behind the keyboard. Android keyboard handling now
  // lives in KeyboardAwareScreen (measured padding, not a KeyboardAvoidingView
  // — edge-to-edge is forced at targetSdk 36, which makes `adjustResize`/
  // `height` unreliable), so assert that it is in place: no KeyboardAvoidingView,
  // and a step's fields sit in the persisted-taps scroll view. Step 1 has no
  // text field, so look at step 2 (title).
  it('handles the keyboard on Android through KeyboardAwareScreen (no KeyboardAvoidingView behavior prop)', async () => {
    Platform.OS = 'android';
    const root = await mount();
    await next(root);
    expect(root.findAll(n => n.props.behavior === 'height')).toHaveLength(0);
    expect(root.findAll(n => n.props.behavior === 'padding')).toHaveLength(0);
    const scroll = root.findAll(n => n.props.keyboardShouldPersistTaps === 'handled')[0];
    expect(scroll).toBeDefined();
    expect(scroll.findAll(n => (n.type as unknown) === 'TextInput').length).toBeGreaterThan(0);
  });

  it('Game: manual picker interaction produces the correct UTC ISO 8601 starts_at timestamp', async () => {
    mockCreateEvent.mockResolvedValueOnce({ id: 'evt-1' } as never);
    const root = await mount();
    await next(root);
    type(titleInput(root), 'Saturday Kickoff');
    await next(root);

    // Pick a date, then a time, as separate native picks: 2030-11-15 14:45
    pick(root, 'Date', new Date(2030, 10, 15, 0, 0));
    pick(root, 'Start time', new Date(2000, 0, 1, 14, 45));
    await advance(root, 2);
    type(capacityInput(root), '12');
    await next(root);
    await submit(root);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Saturday Kickoff',
        capacity: 12,
        starts_at: new Date(2030, 10, 15, 14, 45).toISOString(),
      }),
      { correlationId: expect.any(String) },
    );
  });

  // As built: the v1 fallback has no Registration closes picker (only the v2 TournamentWizard does, lifecycle AD-20);
  // the picked start date is sent as the date part of its ISO timestamp.
  it('Tournament: picking a start date sends its date and no registration close', async () => {
    mockCreateTournament.mockResolvedValueOnce({ id: 't-1' } as never);
    const root = await mount();
    await chooseTournament(root);
    await next(root);
    type(titleInput(root), 'Winter Open');
    await next(root);
    const start = new Date(2030, 11, 1, 9, 0);
    pickDateTime(root, start);
    expect(() => byText(root, 'Registration closes')).toThrow();
    await advance(root, 3);
    await submit(root);

    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Winter Open', starts_at: start.toISOString().slice(0, 10) }),
      { correlationId: expect.any(String) },
    );
    const [payload] = mockCreateTournament.mock.calls[0];
    expect(payload).not.toHaveProperty('registration_closes_at');
  });
});

// Older DES-MEETUP-MOBILE §4.3 controls that the six-step wizard board (design-ref-p23 Game1Type..Game6Invite) does not
// draw. These assert the wizard as built: no quick-select date chips, the first sport pre-selected in both modes, and no
// estimated cost/currency fields (the game fee, behind game_fee_enabled, is the only price on the form).
describe('CreateGameScreen — wizard as built versus the older DES §4.3 field list', () => {
  it('step 3 offers Date and Start time pickers and no quick-select date chips', async () => {
    const root = await mount();
    await advance(root, 2);
    expect(on(root, H.step3)).toBe(true);
    expect(byText(root, 'Date')).toBeDefined();
    expect(byText(root, 'Start time')).toBeDefined();
    expect(() => byText(root, 'Today')).toThrow();
    expect(() => byText(root, 'Tomorrow')).toThrow();
  });

  it('tournament: the first sport is pre-selected, so the payload always carries a sport', async () => {
    mockCreateTournament.mockResolvedValue({ id: 't-1' } as never);
    const root = await mount();
    await chooseTournament(root);
    await fillGameToReview(root, 8);
    await submit(root);
    expect(texts(root)).not.toContain('Choose a sport.');
    expect(mockCreateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ sport: 'badminton' }),
      { correlationId: expect.any(String) },
    );
  });

  it('has no estimated cost or currency field and never sends estimated_cost_*', async () => {
    mockCreateEvent.mockResolvedValueOnce({} as never);
    const root = await mount();
    await fillGameToReview(root);
    expect(() => input(root, 'e.g. 15.00')).toThrow();
    expect(() => input(root, 'USD')).toThrow();
    await submit(root);
    const [payload] = mockCreateEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('estimated_cost_cents');
    expect(payload).not.toHaveProperty('estimated_cost_currency');
  });
});
