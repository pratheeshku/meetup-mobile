/** Game detail + edit wizard with several groups: display, preselect, full-list PATCH, old-server fallback. */
import React from 'react';

import { apiClient } from '../../api/client';
import { updateEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/events', () => ({ ...jest.requireActual('../../api/events'), updateEvent: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;
const mockUpdate = updateEvent as jest.Mock;

const group = (id: string, name: string) => ({
  id, name, description: '', owner_id: 'me', created_at: '', current_user_role: 'owner', member_count: 4,
});
const MY_GROUPS = ['g-1', 'g-2', 'g-3'].map((id, i) => group(id, `Group ${i + 1}`));

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'user-me', sport: 'badminton', title: 'Friday doubles', visibility: 'group',
  capacity: 8, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 1, user_rsvp_status: null, skill_level_requirement: 'all_levels',
  group_ids: ['g-1', 'g-2'], group_names: ['Group 1', 'Group 2'],
  ...overrides,
});

async function mount(overrides: Record<string, unknown> = {}): Promise<Instance> {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/participants') ? [] : rawEvent(overrides) }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const labelled = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (node: Instance): Promise<void> => {
  await act(async () => node.props.onPress());
};
const option = (root: Instance, id: string): Instance | undefined =>
  root.findAll(n => n.props.testID === `group-option-${id}` && typeof n.props.onPress === 'function')[0];
const checkedIds = (root: Instance): string[] =>
  ['g-1', 'g-2', 'g-3', 'g-9'].filter(id => option(root, id)?.props.accessibilityState.checked);
const groupRows = (root: Instance): number =>
  root.findAll(n => n.props.testID === 'group-name-item' && typeof n.type === 'string').length;

async function openEdit(root: Instance): Promise<void> {
  await press(labelled(root, 'Edit Game'));
}

beforeEach(() => {
  mockGet.mockReset();
  mockUpdate.mockReset().mockResolvedValue({ id: 'evt-1' });
  (getMyGroups as jest.Mock).mockReset().mockResolvedValue({ items: MY_GROUPS, total: 3, page: 1, page_size: 3 });
  __resetSportDisplayNamesCacheForTests();
});

describe('game detail group rows', () => {
  it('shows every group the game is shared with (up to three rows)', async () => {
    const root = await mount();
    expect(groupRows(root)).toBe(2);
    expect(texts(root)).toEqual(expect.arrayContaining(['Group 1', 'Group 2']));
  });

  it('shows three rows and "+n more" for a game shared with many groups', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `g-${i + 1}`);
    const root = await mount({ group_ids: ids, group_names: ids.map((_, i) => `Group ${i + 1}`) });
    expect(groupRows(root)).toBe(3);
    expect(texts(root)).toContain('+22 more');
  });

  it('old server: one group from group_id / group_name', async () => {
    const root = await mount({ group_ids: undefined, group_names: undefined, group_id: 'g-1', group_name: 'Group 1' });
    expect(groupRows(root)).toBe(1);
    expect(texts(root)).toContain('Group 1');
  });
});

describe('edit wizard groups', () => {
  it('preselects the game\'s groups', async () => {
    const root = await mount();
    await openEdit(root);
    expect(checkedIds(root)).toEqual(['g-1', 'g-2']);
    expect(texts(root)).toContain('2 selected (max 20)');
  });

  it('old server: preselects the single group_id', async () => {
    const root = await mount({ group_ids: undefined, group_names: undefined, group_id: 'g-2', group_name: 'Group 2' });
    await openEdit(root);
    expect(checkedIds(root)).toEqual(['g-2']);
  });

  it('PATCH sends the full replaced group_ids list', async () => {
    const root = await mount();
    await openEdit(root);
    await press(option(root, 'g-1')!); // off
    await press(option(root, 'g-3')!); // on
    expect(checkedIds(root)).toEqual(['g-2', 'g-3']);
    for (let i = 0; i < 4 && !labelled(root, 'Save changes'); i += 1) await press(labelled(root, 'Next'));
    await press(labelled(root, 'Save changes'));
    expect(mockUpdate.mock.calls[0][1].group_ids).toEqual(['g-2', 'g-3']);
  });

  it('keeps a current group the user is no longer in, by the game\'s own name', async () => {
    const root = await mount({ group_ids: ['g-1', 'g-9'], group_names: ['Group 1', 'Gone group'] });
    await openEdit(root);
    expect(checkedIds(root)).toEqual(['g-1', 'g-9']);
    expect(texts(root)).toContain('Gone group');
  });

  it('needs at least one group: Next is disabled and an error shows', async () => {
    const root = await mount({ group_ids: ['g-1'], group_names: ['Group 1'] });
    await openEdit(root);
    await press(option(root, 'g-1')!);
    expect(labelled(root, 'Next').props.disabled).toBe(true);
    expect(texts(root)).toContain('Choose at least one group');
  });

  it('does not show or send groups for a public game', async () => {
    mockUpdate.mockClear();
    const root = await mount({ visibility: 'public', group_ids: [], group_names: [] });
    await openEdit(root);
    expect(option(root, 'g-1')).toBeUndefined();
    for (let i = 0; i < 4 && !labelled(root, 'Save changes'); i += 1) await press(labelled(root, 'Next'));
    await press(labelled(root, 'Save changes'));
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty('group_ids');
  });
});
