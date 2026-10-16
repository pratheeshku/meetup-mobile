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
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'Search players').length > 0;
const hasEmail = (root: Instance): boolean =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Invite by email').length > 0;
const hasSuggestion = (root: Instance): boolean =>
  root.findAll(n => n.props.testID === `invite-toggle-${ALEX.id}`).length > 0;

it('invite-only shows the search, suggestions and email input', async () => {
  const root = await mountCreateGame([ALEX]);
  await toStep6InviteOnly(root);
  expect(hasSearch(root)).toBe(true);
  expect(hasSuggestion(root)).toBe(true);
  expect(hasEmail(root)).toBe(true);
  expect(texts(root).some(x => x.startsWith('Invite players'))).toBe(true);
});

const GROUP = { id: 'g-1', name: 'Sunday Footballers', description: '', owner_id: 'me', created_at: '', current_user_role: 'owner' };

it.each([['Public'], ['Sunday Footballers']])('%s hides the search, suggestions, email input and chips', async option => {
  const root = await mountCreateGame([ALEX], [GROUP]);
  await press(byLabel(root, 'Next')); // 1 -> 2
  await press(byLabel(root, 'Next')); // 2 -> 3 (default title)
  await press(byLabel(root, 'Next')); // 3 -> 4
  const choice = root.findAll(n => typeof n.props.onPress === 'function' && texts(n).some(x => x.startsWith(option)))[0];
  expect(choice).toBeDefined();
  await press(choice);
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
  expect(hasSearch(root)).toBe(false);
  expect(hasSuggestion(root)).toBe(false);
  expect(hasEmail(root)).toBe(false);
  expect(root.findAll(n => n.props.testID === 'invitee-list')).toHaveLength(0);
  expect(texts(root)).toContain('Review');
});
