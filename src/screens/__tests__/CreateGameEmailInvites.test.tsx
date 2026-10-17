/** create-game step 6: ONE shared search field for people and emails (invite-only games). */
import { createEvent, inviteEmailToEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { act, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import {
  ALEX,
  anyEmailButton,
  byLabel,
  emailButton,
  mountCreateGame,
  press,
  toStep6InviteOnly,
  typeSearch,
} from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const mockCreate = createEvent as jest.Mock;
const mockInviteEmail = inviteEmailToEvent as jest.Mock;
const mockCompletion = showCompletion as jest.Mock;

const rowValue = (label: string): string | undefined =>
  (mockCompletion.mock.calls[0][0].rows as { label: string; value: string }[]).find(r => r.label === label)?.value;
const chips = (root: Instance): string[] => {
  const list = root.findAll(n => n.props.testID === 'invitee-list' && typeof n.type === 'string')[0];
  return list ? texts(list) : [];
};
const addEmailViaSearch = async (root: Instance, email: string): Promise<void> => {
  await typeSearch(root, email);
  await press(emailButton(root, email) as Instance);
};

let spies: jest.SpyInstance[];
beforeEach(() => {
  jest.useFakeTimers();
  mockCreate.mockReset().mockResolvedValue({ id: 'evt-77' });
  mockInviteEmail.mockReset().mockResolvedValue({});
  mockCompletion.mockReset();
  spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => {}),
  );
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  spies.forEach(s => s.mockRestore());
});

describe('one search field', () => {
  it('has exactly one text input on step 6 and no separate "Invite by email" input', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    expect(root.findAll(n => (n.type as unknown) === 'TextInput')).toHaveLength(1);
    expect(root.findAll(n => n.props.accessibilityLabel === 'Invite by email')).toHaveLength(0);
    expect(texts(root)).not.toContain('Invite by email');
    expect(byLabel(root, 'Add')).toBeUndefined();
  });

  it('a valid email that matches nobody shows the Invite button; tapping it adds a chip', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await typeSearch(root, 'newcomer@example.com');
    expect(texts(root)).toContain('Invite newcomer@example.com as new player');
    await press(emailButton(root, 'newcomer@example.com') as Instance);
    expect(chips(root)).toContain('newcomer@example.com');
  });

  it.each([['not-an-email'], ['zzz'], ['a@b'], ['@example.com']])('"%s" shows no email button', async text => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await typeSearch(root, text);
    expect(anyEmailButton(root)).toBe(false);
  });

  it('a valid email that matches a person shows that person, not the email button', async () => {
    const root = await mountCreateGame([{ ...ALEX, display_name: 'alex@example.com', nickname: 'alexe' }]);
    await toStep6InviteOnly(root);
    await typeSearch(root, 'alex@example.com');
    expect(anyEmailButton(root)).toBe(false);
  });

  it('adds a duplicate email (different case) only once', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await addEmailViaSearch(root, 'Sam@Example.com');
    await addEmailViaSearch(root, 'sam@example.COM');
    expect(chips(root).filter(x => x.toLowerCase() === 'sam@example.com')).toHaveLength(1);
    expect(texts(root).find(x => /invited$/.test(x))).toMatch(/1 invited$/);
  });

  it('removes an email chip with its remove control', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await addEmailViaSearch(root, 'gone@example.com');
    await press(byLabel(root, 'Remove gone@example.com'));
    expect(chips(root)).not.toContain('gone@example.com');
  });
});

describe('sending after create', () => {
  it('the email chip leads to exactly one inviteEmailToEvent call after create, with the created id and one correlation id', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await addEmailViaSearch(root, 'a@example.com');
    await press(byLabel(root, 'Create Game'));

    expect(mockInviteEmail).toHaveBeenCalledTimes(1);
    expect(mockInviteEmail.mock.calls[0].slice(0, 2)).toEqual(['evt-77', 'a@example.com']);
    expect(mockInviteEmail.mock.calls[0][2].correlationId).toBe(mockCreate.mock.calls[0][1].correlationId);
    expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(mockInviteEmail.mock.invocationCallOrder[0]);
    expect(rowValue('Invited by email')).toBe('1');
    expect(rowValue('Invited players')).toBe('0');
    expect(rowValue('Could not invite')).toBeUndefined();
  });

  it('one call per email, in order, none for a removed one', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    for (const e of ['a@example.com', 'b@example.com', 'c@example.com']) await addEmailViaSearch(root, e);
    await press(byLabel(root, 'Remove b@example.com'));
    await press(byLabel(root, 'Create Game'));
    expect(mockInviteEmail.mock.calls.map(c => c[1])).toEqual(['a@example.com', 'c@example.com']);
  });

  it('partial failure is listed on the completion screen without blocking the game', async () => {
    mockInviteEmail
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Already invited' } } })
      .mockRejectedValueOnce(new Error('network'));
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    for (const e of ['ok@example.com', 'dup@example.com', 'down@example.com']) await addEmailViaSearch(root, e);
    await press(byLabel(root, 'Create Game'));

    expect(mockCompletion).toHaveBeenCalledTimes(1);
    expect(mockCompletion.mock.calls[0][0].secondary).toEqual({ button: 'view_game', id: 'evt-77' });
    expect(rowValue('Invited by email')).toBe('1');
    const failed = rowValue('Could not invite') ?? '';
    expect(failed).toContain('dup@example.com: Already invited');
    expect(failed).toContain('down@example.com: Could not send the invite. Please try again.');
    expect(failed).not.toContain('ok@example.com');
  });

  it('never writes email addresses to the console', async () => {
    mockInviteEmail.mockRejectedValueOnce(new Error('boom'));
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await addEmailViaSearch(root, 'secret.person@example.com');
    await press(byLabel(root, 'Create Game'));
    expect(JSON.stringify(spies.map(s => s.mock.calls))).not.toContain('secret.person');
  });

  it('makes no email calls when none were added', async () => {
    const root = await mountCreateGame([ALEX]);
    await toStep6InviteOnly(root);
    await press(byLabel(root, 'Create Game'));
    expect(mockInviteEmail).not.toHaveBeenCalled();
    expect(rowValue('Invited by email')).toBe('0');
  });
});
