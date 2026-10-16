/** create-game-email-invites: step 6 "Invite by email" for invite-only games. */
import { createEvent, inviteEmailToEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { texts } from '../../test-utils/render';
import {
  addEmail,
  byLabel,
  mountCreateGame,
  press,
  toStep6InviteOnly,
  typeEmail,
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

const rowsOf = (): { label: string; value: string }[] => mockCompletion.mock.calls[0][0].rows;
const rowValue = (label: string): string | undefined => rowsOf().find(r => r.label === label)?.value;

let spies: jest.SpyInstance[];
beforeEach(() => {
  mockCreate.mockReset().mockResolvedValue({ id: 'evt-77' });
  mockInviteEmail.mockReset().mockResolvedValue({});
  mockCompletion.mockReset();
  spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => {}),
  );
});
afterEach(() => spies.forEach(s => s.mockRestore()));

describe('email validation', () => {
  it('rejects an invalid email with a message and does not add it', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await addEmail(root, 'not-an-email');
    expect(texts(root)).toContain('Enter a valid email address.');
    expect(root.findAll(n => n.props.testID === 'invitee-list')).toHaveLength(0);
  });

  it('adds a valid email and rejects a case-insensitive duplicate', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await addEmail(root, 'Sam@Example.com');
    expect(texts(root)).toContain('Sam@Example.com');
    await addEmail(root, 'sam@example.COM');
    expect(texts(root)).toContain('That email is already added.');
    expect(texts(root).filter(x => x.toLowerCase() === 'sam@example.com')).toHaveLength(1);
  });

  it('clears the error when typing again and trims whitespace', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await addEmail(root, 'bad');
    await typeEmail(root, 'x');
    expect(texts(root)).not.toContain('Enter a valid email address.');
    await addEmail(root, '  pat@example.com  ');
    expect(texts(root)).toContain('pat@example.com');
  });
});

describe('sending after create', () => {
  it('calls inviteEmailToEvent once per email with the created event id and one shared correlation id', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await addEmail(root, 'a@example.com');
    await addEmail(root, 'b@example.com');
    await press(byLabel(root, 'Create Game'));

    expect(mockInviteEmail).toHaveBeenCalledTimes(2);
    expect(mockInviteEmail.mock.calls.map(c => [c[0], c[1]])).toEqual([
      ['evt-77', 'a@example.com'],
      ['evt-77', 'b@example.com'],
    ]);
    const ids = new Set([
      mockCreate.mock.calls[0][1].correlationId,
      mockInviteEmail.mock.calls[0][2].correlationId,
      mockInviteEmail.mock.calls[1][2].correlationId,
    ]);
    expect(ids.size).toBe(1);
    expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(mockInviteEmail.mock.invocationCallOrder[0]);
    expect(rowValue('Invited by email')).toBe('2');
    expect(rowValue('Invited players')).toBe('0');
    expect(rowValue('Could not invite')).toBeUndefined();
  });

  it('shows partial failures on the completion screen without rolling back the game', async () => {
    mockInviteEmail
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Already invited' } } })
      .mockRejectedValueOnce(new Error('network'));
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    for (const e of ['ok@example.com', 'dup@example.com', 'down@example.com']) await addEmail(root, e);
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
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await addEmail(root, 'secret.person@example.com');
    await press(byLabel(root, 'Create Game'));
    expect(JSON.stringify(spies.map(s => s.mock.calls))).not.toContain('secret.person');
  });

  it('makes no email calls when none were added', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await press(byLabel(root, 'Create Game'));
    expect(mockInviteEmail).not.toHaveBeenCalled();
    expect(rowValue('Invited by email')).toBe('0');
  });
});
