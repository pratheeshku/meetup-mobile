/** Remarks on game creation (team-screens-remarks AD-4, TS-10, TS-T13): optional, 5000 characters, sent as `description`, null when blank. */
import { createEvent } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { act } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { byLabel, mountCreateGame, press, toStep6InviteOnly } from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const mockCreateEvent = createEvent as jest.Mock;

const remarksField = (root: Instance): Instance =>
  root.find(n => (n.type as unknown) === 'TextInput' && n.props.testID === 'game-remarks');

beforeEach(() => {
  mockCreateEvent.mockReset().mockResolvedValue({ id: 'evt-1' });
  (showCompletion as jest.Mock).mockReset();
});

describe('Remarks on step 6', () => {
  it('is an optional field with the seeded label and placeholder, limited to 5000 characters', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    const field = remarksField(root);
    expect(field.props.accessibilityLabel).toBe('Remarks (optional)');
    expect(field.props.placeholder).toBe('Anything else players should know');
    expect(field.props.maxLength).toBe(5000);
    expect(field.props.multiline).toBe(true);
  });

  it('left blank (or whitespace) it sends description null and does not block the create', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await act(async () => {
      remarksField(root).props.onChangeText('   ');
    });
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateEvent.mock.calls[0][0].description).toBeNull();
  });

  it('typed text is sent trimmed as description, plain text as typed', async () => {
    const root = await mountCreateGame();
    await toStep6InviteOnly(root);
    await act(async () => {
      remarksField(root).props.onChangeText('  Bring shuttles <b>please</b>\nCourt 3  ');
    });
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent.mock.calls[0][0].description).toBe('Bring shuttles <b>please</b>\nCourt 3');
  });
});
