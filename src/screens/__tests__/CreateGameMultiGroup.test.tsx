/** Create game: multi-select group step (toggle, cap, at-least-one, group_ids payload, search, summary). */
import { createEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { act, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { byLabel, mountCreateGame, press } from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const group = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: '', owner_id: 'me', created_at: '', current_user_role: 'owner', member_count: 5, ...extra,
});
const many = (count: number) => Array.from({ length: count }, (_, i) => group(`g-${i + 1}`, `Group ${i + 1}`));

const option = (root: Instance, id: string): Instance =>
  root.findAll(n => n.props.testID === `group-option-${id}` && typeof n.props.onPress === 'function')[0];
const checked = (root: Instance, id: string): boolean => option(root, id).props.accessibilityState.checked;
const toggle = (root: Instance, id: string) => press(option(root, id));
const has = (root: Instance, testID: string): boolean =>
  root.findAll(n => n.props.testID === testID && typeof n.type === 'string').length > 0;
const next = (root: Instance) => press(byLabel(root, 'Next'));

async function toGroupStep(groups: unknown[]): Promise<Instance> {
  const root = await mountCreateGame([], groups);
  await next(root);
  await next(root);
  await next(root);
  return root;
}

async function createGame(root: Instance): Promise<Record<string, unknown>> {
  await next(root); // 4 -> 5
  await next(root); // 5 -> 6
  await press(byLabel(root, 'Create Game'));
  return (createEvent as jest.Mock).mock.calls[0][0];
}

beforeEach(() => {
  (createEvent as jest.Mock).mockReset().mockResolvedValue({ id: 'evt-1' });
  (showCompletion as jest.Mock).mockReset();
});

describe('group multi-select', () => {
  it('lists groups as checkboxes with the member count line and preselects the first', async () => {
    const root = await toGroupStep([group('g-1', 'Sunday Footballers', { member_count: 7 }), group('g-2', 'Office League')]);
    expect(option(root, 'g-1').props.accessibilityRole).toBe('checkbox');
    expect(texts(root)).toContain('7 group members get this game');
    expect(checked(root, 'g-1')).toBe(true);
    expect(checked(root, 'g-2')).toBe(false);
    expect(texts(root)).toContain('1 selected (max 20)');
  });

  it('toggles groups on and off independently', async () => {
    const root = await toGroupStep(many(3));
    await toggle(root, 'g-2');
    await toggle(root, 'g-3');
    expect([1, 2, 3].map(i => checked(root, `g-${i}`))).toEqual([true, true, true]);
    expect(texts(root)).toContain('3 selected (max 20)');
    await toggle(root, 'g-1');
    expect([1, 2, 3].map(i => checked(root, `g-${i}`))).toEqual([false, true, true]);
    expect(texts(root)).toContain('2 selected (max 20)');
  });

  it('lists groups with the most recent activity first', async () => {
    const root = await toGroupStep([
      group('old', 'Old group', { last_activity_at: '2026-01-01T00:00:00Z' }),
      group('new', 'New group', { last_activity_at: '2026-10-01T00:00:00Z' }),
    ]);
    const order = root.findAll(n => /^group-option-/.test(String(n.props.testID)) && typeof n.type === 'string').map(n => n.props.testID);
    expect(order).toEqual(['group-option-new', 'group-option-old']);
    expect(checked(root, 'new')).toBe(true);
  });

  it('filters by the search box', async () => {
    const root = await toGroupStep([group('g-1', 'Sunday Footballers'), group('g-2', 'Office League')]);
    const search = root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search groups');
    await act(async () => search.props.onChangeText('office'));
    expect(option(root, 'g-1')).toBeUndefined();
    expect(option(root, 'g-2')).toBeDefined();
    await act(async () => search.props.onChangeText('zzz'));
    expect(texts(root)).toContain('No groups match your search');
  });

  it('blocks selecting past the cap and says why', async () => {
    const root = await toGroupStep(many(22));
    for (let i = 2; i <= 20; i += 1) await toggle(root, `g-${i}`);
    expect(texts(root)).toContain('20 selected (max 20)');
    expect(has(root, 'group-cap-message')).toBe(true);
    await toggle(root, 'g-21');
    expect(checked(root, 'g-21')).toBe(false);
    expect(texts(root)).toContain('20 selected (max 20)');
    expect(texts(root).some(x => x.startsWith('You can share a game with up to 20 groups'))).toBe(true);
    await toggle(root, 'g-20'); // deselecting frees a slot
    expect(has(root, 'group-cap-message')).toBe(false);
    await toggle(root, 'g-21');
    expect(checked(root, 'g-21')).toBe(true);
  });

  it('needs at least one group: Next is disabled and a message shows', async () => {
    const root = await toGroupStep(many(2));
    await toggle(root, 'g-1');
    expect(has(root, 'group-required-message')).toBe(true);
    expect(texts(root)).toContain('Choose at least one group');
    expect(byLabel(root, 'Next').props.disabled).toBe(true);
    await toggle(root, 'g-2');
    expect(has(root, 'group-required-message')).toBe(false);
    expect(byLabel(root, 'Next').props.disabled).toBeFalsy();
  });
});

describe('payload and summary', () => {
  it('sends the selected group_ids', async () => {
    const root = await toGroupStep(many(3));
    await toggle(root, 'g-3');
    const payload = await createGame(root);
    expect(payload.visibility).toBe('group');
    expect(payload.group_ids).toEqual(['g-1', 'g-3']);
  });

  it('omits group_ids for a public game', async () => {
    const root = await toGroupStep(many(2));
    await press(root.findAll(n => typeof n.props.onPress === 'function' && texts(n).some(x => x.startsWith('Public')))[0]);
    const payload = await createGame(root);
    expect(payload.visibility).toBe('public');
    expect(payload).not.toHaveProperty('group_ids');
  });

  it('summary lists the group names, capped at three with "+n more"', async () => {
    const root = await toGroupStep(many(6));
    for (let i = 2; i <= 6; i += 1) await toggle(root, `g-${i}`);
    await next(root);
    await next(root);
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(['Group 1', 'Group 2', 'Group 3', '+3 more']));
    expect(all.some(x => x.includes('Group 1 +5 more'))).toBe(true);
  });
});
