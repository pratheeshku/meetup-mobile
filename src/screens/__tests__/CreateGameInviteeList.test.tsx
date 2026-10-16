/** create-game-added-invitees-list: everyone added appears under the search box, with remove. */
import { createEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import {
  addEmail,
  ALEX,
  BO,
  byLabel,
  mountCreateGame,
  press,
  suggestionToggle,
  toStep6InviteOnly,
} from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const list = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'invitee-list' && typeof n.type === 'string');
const listTexts = (root: Instance): string[] => (list(root)[0] ? texts(list(root)[0]) : []);
const reviewCount = (root: Instance): string | undefined => texts(root).find(x => /invited$/.test(x));

beforeEach(() => {
  (createEvent as jest.Mock).mockReset().mockResolvedValue({ id: 'evt-1' });
  (showCompletion as jest.Mock).mockReset();
});

it('shows nothing when no one is added', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  expect(list(root)).toHaveLength(0);
  expect(reviewCount(root)).toBe('4 players · Invite only · 0 invited');
});

it('adds a player to the list under the search box when a suggestion is toggled, and keeps the review count in sync', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await press(suggestionToggle(root, ALEX.id));
  expect(listTexts(root)).toContain('Alex Chen');
  expect(listTexts(root)).toContain('AC');
  expect(reviewCount(root)).toMatch(/1 invited$/);
  // Order: search box, then the added list, then the suggestions.
  const order = root
    .findAll(n => typeof n.type === 'string' && typeof n.props.testID === 'string')
    .map(n => n.props.testID as string);
  expect(order.indexOf('invitee-list')).toBeGreaterThanOrEqual(0);
  expect(order.indexOf('invitee-list')).toBeLessThan(order.indexOf(`invite-toggle-${BO.id}`));
  expect(texts(root)).toContain('Bo Lim');
});

it('toggling the suggestion again removes the person from the list', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await press(suggestionToggle(root, ALEX.id));
  await press(suggestionToggle(root, ALEX.id));
  expect(list(root)).toHaveLength(0);
});

it('removes a player with the x control in the list', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await press(suggestionToggle(root, ALEX.id));
  await press(suggestionToggle(root, BO.id));
  expect(reviewCount(root)).toMatch(/2 invited$/);
  await press(byLabel(root, 'Remove Alex Chen'));
  expect(listTexts(root)).not.toContain('Alex Chen');
  expect(listTexts(root)).toContain('Bo Lim');
  expect(reviewCount(root)).toMatch(/1 invited$/);
});

it('lists emails with players, removes them, and counts both', async () => {
  const root = await mountCreateGame([ALEX]);
  await toStep6InviteOnly(root);
  await press(suggestionToggle(root, ALEX.id));
  await addEmail(root, 'sam@example.com');
  expect(listTexts(root)).toEqual(expect.arrayContaining(['Alex Chen', 'sam@example.com', 'S']));
  expect(reviewCount(root)).toMatch(/2 invited$/);
  await press(byLabel(root, 'Remove sam@example.com'));
  expect(listTexts(root)).not.toContain('sam@example.com');
  expect(reviewCount(root)).toMatch(/1 invited$/);
});

it('removing a listed player does not send them on submit', async () => {
  const root = await mountCreateGame([ALEX]);
  await toStep6InviteOnly(root);
  await press(suggestionToggle(root, ALEX.id));
  await press(byLabel(root, 'Remove Alex Chen'));
  await press(byLabel(root, 'Create Game'));
  expect((createEvent as jest.Mock).mock.calls[0][0]).not.toHaveProperty('invite_user_ids');
});
