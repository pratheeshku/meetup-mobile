/** Shared wizard driver for the Create Game step 6 tests (not a test file). */
import React from 'react';

import { getMyGroups } from '../api/groups';
import { getSports } from '../api/sports';
import { searchUsers } from '../api/users';
import { act, renderAsync } from './render';
import type { Instance } from './render';
import CreateGameScreen from '../screens/CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

export const ALEX = { id: 'u-1', nickname: 'alex', display_name: 'Alex Chen', pending: false };
export const BO = { id: 'u-2', nickname: 'bo', display_name: 'Bo Lim', pending: false };

export async function mountCreateGame(users: unknown[] = [], groups: unknown[] = []): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([
    { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' },
  ]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: groups, total: groups.length, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue(users);
  const props = { navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

export const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

export const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};

export async function toStep6InviteOnly(root: Instance): Promise<void> {
  await press(byLabel(root, 'Next')); // 1 -> 2
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && /e\.g\./.test(String(n.props.placeholder)))
      .props.onChangeText('Friday doubles');
  });
  await press(byLabel(root, 'Next')); // 2 -> 3
  await press(byLabel(root, 'Next')); // 3 -> 4
  await press(byLabel(root, 'Invite only'));
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
}

export const emailField = (root: Instance): Instance =>
  root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Invite by email');

export async function typeEmail(root: Instance, value: string): Promise<void> {
  await act(async () => {
    emailField(root).props.onChangeText(value);
  });
}

export async function addEmail(root: Instance, value: string): Promise<void> {
  await typeEmail(root, value);
  await press(byLabel(root, 'Add'));
}

/** The add/remove toggle of a suggestion row, found by user id. */
export const suggestionToggle = (root: Instance, userId: string): Instance =>
  root.findAll(n => n.props.testID === `invite-toggle-${userId}` && typeof n.props.onPress === 'function')[0];
