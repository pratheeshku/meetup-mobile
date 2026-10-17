/**
 * All-levels skill requirement: 2x2 single-select pills on create + edit wizard,
 * payload values (Advanced -> 'expert'), and the display label for all four values.
 */
import React from 'react';

import { createEvent, updateEvent } from '../../api/events';
import { apiClient } from '../../api/client';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament } from '../../api/tournaments';
import { searchUsers } from '../../api/users';
import { showCompletion } from '../../navigation/showCompletion';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import CreateGameScreen from '../CreateGameScreen';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ ...jest.requireActual('../../api/events'), createEvent: jest.fn(), updateEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));
jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockCreateEvent = createEvent as jest.Mock;
const mockUpdateEvent = updateEvent as jest.Mock;
const mockGet = apiClient.get as jest.Mock;

const LEVELS = [
  ['all_levels', 'All levels'],
  ['beginner', 'Beginner'],
  ['intermediate', 'Intermediate'],
  ['expert', 'Advanced'],
] as const;

const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};
const pill = (root: Instance, level: string): Instance =>
  root.findAll(n => n.props.testID === `skill-requirement-${level}` && typeof n.props.onPress === 'function')[0];
const selected = (root: Instance): string[] =>
  LEVELS.filter(([l]) => pill(root, l)?.props.accessibilityState?.selected).map(([l]) => l);

async function mountCreate(): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([
    { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' },
  ]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue([]);
  (createTournament as jest.Mock).mockResolvedValue({ id: 't-1' });
  mockCreateEvent.mockResolvedValue({ id: 'evt-1' });
  const props = { navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as React.ComponentProps<typeof CreateGameScreen>)} />);
}

/** Walks to the step that holds the skill pills (stops as soon as they render). */
async function toSkillStep(root: Instance): Promise<void> {
  await press(byLabel(root, 'Next'));
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === undefined && /e\.g\./.test(String(n.props.placeholder)))
      .props.onChangeText('Friday');
  });
  for (let i = 0; i < 4 && !pill(root, 'all_levels'); i += 1) await press(byLabel(root, 'Next'));
}

const toReview = async (root: Instance): Promise<void> => {
  for (let i = 0; i < 4 && !byLabel(root, 'Create Game'); i += 1) await press(byLabel(root, 'Next'));
};

const rawEvent = (skill: string | null): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'user-me', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 8, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 1, user_rsvp_status: null, skill_level_requirement: skill,
});

async function mountDetail(skill: string | null): Promise<Instance> {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/participants') ? [] : rawEvent(skill) }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

async function openEditSkillStep(root: Instance): Promise<void> {
  await act(async () => {
    root.findAll(n => n.props.accessibilityLabel === 'Edit Game' && typeof n.props.onPress === 'function')[0].props.onPress();
  });
  for (let i = 0; i < 4 && !pill(root, 'all_levels'); i += 1) await press(byLabel(root, 'Next'));
}

beforeEach(() => {
  [mockCreateEvent, mockUpdateEvent, mockGet, showCompletion as jest.Mock].forEach(m => m.mockReset());
  __resetSportDisplayNamesCacheForTests();
});

describe('Create game skill pills', () => {
  it('renders a 2x2 grid of four pills: All levels, Beginner / Intermediate, Advanced', async () => {
    const root = await mountCreate();
    await toSkillStep(root);
    const rows = root.findAll(n => n.props.testID === 'skill-requirement-row' && typeof n.type === 'string');
    expect(rows).toHaveLength(2);
    const rowLevels = rows.map(r => [
      ...new Set(
        r.findAll(n => /^skill-requirement-(?!row)/.test(String(n.props.testID))).map(n => n.props.testID as string),
      ),
    ]);
    expect(rowLevels).toEqual([
      ['skill-requirement-all_levels', 'skill-requirement-beginner'],
      ['skill-requirement-intermediate', 'skill-requirement-expert'],
    ]);
    expect(texts(rows[0])).toEqual(['All levels', 'Beginner']);
    expect(texts(rows[1])).toEqual(['Intermediate', 'Advanced']);
  });

  it('defaults to All levels and sends it', async () => {
    const root = await mountCreate();
    await toSkillStep(root);
    expect(selected(root)).toEqual(['all_levels']);
    await toReview(root);
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent.mock.calls[0][0].skill_level_requirement).toBe('all_levels');
  });

  it.each(LEVELS)('selecting %s is single-select and sends it', async (level, label) => {
    const root = await mountCreate();
    await toSkillStep(root);
    await press(pill(root, level));
    expect(selected(root)).toEqual([level]);
    expect(texts(root)).toContain(label);
    await toReview(root);
    expect(texts(root).some(x => x.includes(label))).toBe(true);
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent.mock.calls[0][0].skill_level_requirement).toBe(level);
  });
});

describe('Edit wizard skill pills', () => {
  it.each(LEVELS)('preselects the current value %s', async (level) => {
    const root = await mountDetail(level);
    await openEditSkillStep(root);
    expect(selected(root)).toEqual([level]);
  });

  it('preselects All levels when the game has no requirement', async () => {
    const root = await mountDetail(null);
    await openEditSkillStep(root);
    expect(selected(root)).toEqual(['all_levels']);
  });

  it('sends expert for Advanced', async () => {
    mockUpdateEvent.mockResolvedValue({ id: 'evt-1' });
    const root = await mountDetail('all_levels');
    await openEditSkillStep(root);
    await press(pill(root, 'expert'));
    expect(selected(root)).toEqual(['expert']);
    for (let i = 0; i < 4 && !byLabel(root, 'Save changes'); i += 1) await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Save changes'));
    expect(mockUpdateEvent.mock.calls[0][1].skill_level_requirement).toBe('expert');
  });
});

describe('Game detail label', () => {
  it.each(LEVELS)('renders %s as "%s"', async (level, label) => {
    const root = await mountDetail(level);
    expect(texts(root).some(x => x.includes(`· ${label}`))).toBe(true);
  });
});
