/**
 * game-invite-only-optional-players: an invite-only game may be created with
 * zero invited players; invited players are still sent when chosen.
 */
import React from 'react';

import { createEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { searchUsers } from '../../api/users';
import { showCompletion } from '../../navigation/showCompletion';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGameScreen from '../CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const mockCreateEvent = createEvent as jest.Mock;
const mockShowCompletion = showCompletion as jest.Mock;

const ALEX = { id: 'u-1', nickname: 'alex', display_name: 'Alex C' };

async function mount(): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([
    { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' },
  ]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue([ALEX]);
  mockCreateEvent.mockResolvedValue({ id: 'evt-1' });
  const props = { navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};

async function toStep6(root: Instance): Promise<void> {
  await press(byLabel(root, 'Next')); // 1 -> 2
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'e.g. Sunday 5-a-side Football')
      .props.onChangeText('Friday doubles');
  });
  await press(byLabel(root, 'Next')); // 2 -> 3
  await press(byLabel(root, 'Next')); // 3 -> 4
  await press(byLabel(root, 'Invite only'));
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
}

beforeEach(() => {
  mockCreateEvent.mockReset();
  mockShowCompletion.mockReset();
});

describe('invite-only game with optional players', () => {
  it('step 6 does not say players are mandatory', async () => {
    const root = await mount();
    await toStep6(root);
    expect(texts(root).join('|')).not.toMatch(/at least 1/i);
    expect(texts(root)).toContain('(optional)');
  });

  it('submits with zero invites: no invite_user_ids, completion shows invited = 0', async () => {
    const root = await mount();
    await toStep6(root);
    await press(byLabel(root, 'Create Game'));

    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    const body = mockCreateEvent.mock.calls[0][0];
    expect(body.visibility).toBe('invite_only');
    expect(body).not.toHaveProperty('invite_user_ids');
    const rows = mockShowCompletion.mock.calls[0][0].rows as { label: string; value: string }[];
    expect(rows.find(r => r.label === 'Invited players')?.value).toBe('0');
  });

  it('still sends invite_user_ids when players are invited', async () => {
    const root = await mount();
    await toStep6(root);
    await press(root.findAll(n => n.props.testID === 'user-search-row' && typeof n.props.onPress === 'function')[0]);
    await press(byLabel(root, 'Create Game'));

    expect(mockCreateEvent.mock.calls[0][0].invite_user_ids).toEqual(['u-1']);
    const rows = mockShowCompletion.mock.calls[0][0].rows as { label: string; value: string }[];
    expect(rows.find(r => r.label === 'Invited players')?.value).toBe('1');
  });
});
