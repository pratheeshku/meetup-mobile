/** create-game step 6: chips (players and emails) sit under the picker's text box. */
import { createEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { act, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import {
  ALEX,
  BO,
  byLabel,
  emailButton,
  mountCreateGame,
  pickRow,
  press,
  resultRows,
  toStep6InviteOnly,
  typeSearch,
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
const rowNames = (root: Instance): string[] => resultRows(root).map(r => String(r.props.accessibilityLabel));

beforeEach(() => {
  jest.useFakeTimers();
  (createEvent as jest.Mock).mockReset().mockResolvedValue({ id: 'evt-1' });
  (showCompletion as jest.Mock).mockReset();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

it('shows no chips when no one is added', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  expect(list(root)).toHaveLength(0);
  expect(reviewCount(root)).toBe('4 players · Invite only · 0 invited');
});

it('typing a name shows suggestions; picking one adds a chip and removes it from the suggestions', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await typeSearch(root, 'alex');
  expect(rowNames(root).some(n => n.includes('Alex Chen'))).toBe(true);
  expect(rowNames(root).some(n => n.includes('Bo Lim'))).toBe(false);

  await pickRow(root, 'Alex Chen');
  expect(listTexts(root)).toEqual(expect.arrayContaining(['Alex Chen', 'AC']));
  expect(reviewCount(root)).toMatch(/1 invited$/);
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(rowNames(root).some(n => n.includes('Alex Chen'))).toBe(false); // excludeUserIds
  expect(rowNames(root).some(n => n.includes('Bo Lim'))).toBe(true);
});

it('chips are directly under the text box and above the suggestions', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await pickRow(root, 'Alex Chen');
  const order = root
    .findAll(n => typeof n.type === 'string' && (n.props.testID === 'invitee-list' || n.props.testID === 'user-search-row' || (n.type as unknown) === 'TextInput'))
    .map(n => ((n.type as unknown) === 'TextInput' ? 'input' : (n.props.testID as string)));
  expect(order.indexOf('input')).toBeLessThan(order.indexOf('invitee-list'));
  expect(order.indexOf('invitee-list')).toBeLessThan(order.indexOf('user-search-row'));
});

it('removes a player with the x control; the person returns to the suggestions', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await pickRow(root, 'Alex Chen');
  await pickRow(root, 'Bo Lim');
  expect(reviewCount(root)).toMatch(/2 invited$/);
  await press(byLabel(root, 'Remove Alex Chen'));
  expect(listTexts(root)).not.toContain('Alex Chen');
  expect(listTexts(root)).toContain('Bo Lim');
  expect(reviewCount(root)).toMatch(/1 invited$/);
  expect(rowNames(root).some(n => n.includes('Alex Chen'))).toBe(true);
});

it('lists emails with players, removes them, and counts both', async () => {
  const root = await mountCreateGame([ALEX]);
  await toStep6InviteOnly(root);
  await pickRow(root, 'Alex Chen');
  await typeSearch(root, 'sam@example.com');
  await press(emailButton(root, 'sam@example.com') as Instance);
  expect(listTexts(root)).toEqual(expect.arrayContaining(['Alex Chen', 'sam@example.com', 'S']));
  expect(reviewCount(root)).toMatch(/2 invited$/);
  await press(byLabel(root, 'Remove sam@example.com'));
  expect(listTexts(root)).not.toContain('sam@example.com');
  expect(reviewCount(root)).toMatch(/1 invited$/);
});

it('invite_user_ids carries the listed players; a removed player is not sent', async () => {
  const root = await mountCreateGame([ALEX, BO]);
  await toStep6InviteOnly(root);
  await pickRow(root, 'Alex Chen');
  await pickRow(root, 'Bo Lim');
  await press(byLabel(root, 'Remove Alex Chen'));
  await press(byLabel(root, 'Create Game'));
  expect((createEvent as jest.Mock).mock.calls[0][0].invite_user_ids).toEqual([BO.id]);
});
