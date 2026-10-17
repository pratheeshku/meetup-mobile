/** Create game group picker shows each group's real member count (from the settings lists). */
import { getMyGroups } from '../../api/groups';
import { texts } from '../../test-utils/render';
import { byLabel, mountCreateGame, press } from '../../test-utils/createGameHarness';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const group = (id: string, name: string, member_count?: number | null) => ({
  id, name, description: '', owner_id: 'me', created_at: '', current_user_role: 'owner', member_count,
});

async function toGroupStep(groups: unknown[]) {
  const root = await mountCreateGame([], groups);
  await press(byLabel(root, 'Next'));
  await press(byLabel(root, 'Next'));
  await press(byLabel(root, 'Next'));
  return root;
}

it('shows the real member count for each group', async () => {
  const root = await toGroupStep([group('g-1', 'Sunday Footballers', 7), group('g-2', 'Office League', 12)]);
  expect(texts(root)).toEqual(expect.arrayContaining(['7 group members get this game', '12 group members get this game']));
  expect(getMyGroups).toHaveBeenCalled();
});

it('falls back to 0 only when the backend sends no count', async () => {
  const root = await toGroupStep([group('g-1', 'No Count', null)]);
  expect(texts(root)).toContain('0 group members get this game');
});
