/**
 * Step 6: the invite UI (shared player search, chips, email affordance) and the invite payload
 * are there for EVERY game type: public, group and invite-only (owner decision 2026-10-17).
 */
import { createEvent, inviteEmailToEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { act, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import {
  ALEX,
  byLabel,
  emailButton,
  mountCreateGame,
  pickRow,
  press,
  typeSearch,
} from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const GROUP = { id: 'g-1', name: 'Sunday Footballers', description: '', owner_id: 'me', created_at: '', current_user_role: 'owner' };

const hasSearch = (root: Instance): boolean =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search users').length > 0;
const hasRows = (root: Instance): boolean => root.findAll(n => n.props.testID === 'user-search-row').length > 0;
const textInputs = (root: Instance): number => root.findAll(n => (n.type as unknown) === 'TextInput').length;
const chips = (root: Instance): string[] => {
  const list = root.findAll(n => n.props.testID === 'invitee-list' && typeof n.type === 'string')[0];
  return list ? texts(list) : [];
};
const rowValue = (label: string): string | undefined =>
  (((showCompletion as jest.Mock).mock.calls[0][0].rows) as { label: string; value: string }[]).find(r => r.label === label)?.value;

const CASES = [
  { name: 'Public', option: 'Public', review: (n: number) => (n ? `4 players · Public · ${n} invited` : '4 players · Public'), group: false },
  { name: 'Group', option: 'Sunday Footballers', review: (n: number) => (n ? `4 players · Sunday Footballers · ${n} invited` : '4 players · Sunday Footballers'), group: true },
  { name: 'Invite-only', option: 'Invite only', review: (n: number) => `4 players · Invite only · ${n} invited`, group: false },
] as const;

/** Wizard to step 6 with the chosen visibility; proves the choice took effect via the review line. */
async function toStep6(root: Instance, option: string): Promise<void> {
  const pick = (name: string): Instance =>
    root.findAll(n => typeof n.props.onPress === 'function' && texts(n).some(x => x.startsWith(name)))[0];
  await press(byLabel(root, 'Next')); // 1 -> 2
  await press(byLabel(root, 'Next')); // 2 -> 3 (default title)
  await press(byLabel(root, 'Next')); // 3 -> 4
  // A group is pre-selected by default when the user has one, so move away first;
  // the explicit click below is then what selects the option.
  expect(pick('Public')).toBeDefined();
  await press(pick('Public'));
  expect(pick(option)).toBeDefined();
  await press(pick(option));
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
}

beforeEach(() => {
  jest.useFakeTimers();
  (createEvent as jest.Mock).mockReset().mockResolvedValue({ id: 'evt-1' });
  (inviteEmailToEvent as jest.Mock).mockReset().mockResolvedValue({});
  (showCompletion as jest.Mock).mockReset();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe.each(CASES)('$name game', ({ option, review, group }) => {
  it('shows the one shared search field with suggestions, and the visibility really took effect', async () => {
    const root = await mountCreateGame([ALEX], [GROUP]);
    await toStep6(root, option);
    expect(texts(root)).toContain(review(0)); // selected audience in the review
    expect(hasSearch(root)).toBe(true);
    expect(hasRows(root)).toBe(true);
    expect(textInputs(root)).toBe(1);
  });

  it('adds a person and an email: chips, review count, payload, one email call, completion counts', async () => {
    const root = await mountCreateGame([ALEX], [GROUP]);
    await toStep6(root, option);
    await pickRow(root, 'Alex Chen');
    await typeSearch(root, 'new@example.com');
    await press(emailButton(root, 'new@example.com') as Instance);

    expect(chips(root)).toEqual(expect.arrayContaining(['Alex Chen', 'new@example.com']));
    expect(texts(root)).toContain(review(2)); // review text and count stay in sync

    await press(byLabel(root, 'Create Game'));
    const body = (createEvent as jest.Mock).mock.calls[0][0];
    expect(body.invite_user_ids).toEqual([ALEX.id]);
    if (group) {
      expect(body.visibility).toBe('group');
      expect(body.group_ids).toEqual(['g-1']); // group games keep sending group_ids as well
    } else {
      expect(body).not.toHaveProperty('group_ids');
    }
    const inviteCalls = (inviteEmailToEvent as jest.Mock).mock.calls;
    expect(inviteCalls).toHaveLength(1);
    expect(inviteCalls[0].slice(0, 2)).toEqual(['evt-1', 'new@example.com']);
    expect(inviteCalls[0][2].correlationId).toBe((createEvent as jest.Mock).mock.calls[0][1].correlationId);
    expect(rowValue('Invited players')).toBe('1');
    expect(rowValue('Invited by email')).toBe('1');
  });

  it('a failed email invite is listed on completion and never blocks the game', async () => {
    (inviteEmailToEvent as jest.Mock).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Already invited' } } });
    const root = await mountCreateGame([ALEX], [GROUP]);
    await toStep6(root, option);
    await typeSearch(root, 'dup@example.com');
    await press(emailButton(root, 'dup@example.com') as Instance);
    await press(byLabel(root, 'Create Game'));
    expect(showCompletion).toHaveBeenCalledTimes(1);
    expect(rowValue('Could not invite')).toContain('dup@example.com: Already invited');
  });

  it('with nobody added: no invite_user_ids, no email calls', async () => {
    const root = await mountCreateGame([ALEX], [GROUP]);
    await toStep6(root, option);
    await press(byLabel(root, 'Create Game'));
    expect((createEvent as jest.Mock).mock.calls[0][0]).not.toHaveProperty('invite_user_ids');
    expect(inviteEmailToEvent).not.toHaveBeenCalled();
  });
});

it('a removed person is not sent, in any visibility', async () => {
  const root = await mountCreateGame([ALEX], [GROUP]);
  await toStep6(root, 'Public');
  await pickRow(root, 'Alex Chen');
  await press(byLabel(root, 'Remove Alex Chen'));
  await press(byLabel(root, 'Create Game'));
  expect((createEvent as jest.Mock).mock.calls[0][0]).not.toHaveProperty('invite_user_ids');
});
