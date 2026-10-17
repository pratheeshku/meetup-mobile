/** Step 6: player search, email invite and added-invitees chips are invite-only. */
import { texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { ALEX, byLabel, mountCreateGame, press, toStep6InviteOnly } from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const hasSearch = (root: Instance): boolean =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search users').length > 0;
const hasRows = (root: Instance): boolean => root.findAll(n => n.props.testID === 'user-search-row').length > 0;
const textInputs = (root: Instance): number => root.findAll(n => (n.type as unknown) === 'TextInput').length;

it('invite-only shows the one shared search field and its suggestions', async () => {
  const root = await mountCreateGame([ALEX]);
  await toStep6InviteOnly(root);
  expect(hasSearch(root)).toBe(true);
  expect(hasRows(root)).toBe(true);
  expect(textInputs(root)).toBe(1);
  expect(texts(root).some(x => x.startsWith('Invite players'))).toBe(true);
});

const GROUP = { id: 'g-1', name: 'Sunday Footballers', description: '', owner_id: 'me', created_at: '', current_user_role: 'owner' };

it.each([
  ['Public', '4 players · Public'],
  ['Sunday Footballers', '4 players · Sunday Footballers'],
])('%s hides the search field, suggestions and chips', async (option, reviewLine) => {
  const root = await mountCreateGame([ALEX], [GROUP]);
  await press(byLabel(root, 'Next')); // 1 -> 2
  await press(byLabel(root, 'Next')); // 2 -> 3 (default title)
  await press(byLabel(root, 'Next')); // 3 -> 4
  const pick = (name: string): Instance =>
    root.findAll(n => typeof n.props.onPress === 'function' && texts(n).some(x => x.startsWith(name)))[0];
  // A group is pre-selected by default when the user has one, so move away first;
  // the explicit group click below is then what selects it.
  expect(pick('Public')).toBeDefined();
  await press(pick('Public'));
  expect(pick(option)).toBeDefined();
  await press(pick(option));
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
  // The visibility choice really took effect (review reflects the chosen audience).
  expect(texts(root)).toContain(reviewLine);
  expect(hasSearch(root)).toBe(false);
  expect(hasRows(root)).toBe(false);
  expect(textInputs(root)).toBe(0);
  expect(root.findAll(n => n.props.testID === 'invitee-list')).toHaveLength(0);
  expect(texts(root)).toContain('Review');
});
