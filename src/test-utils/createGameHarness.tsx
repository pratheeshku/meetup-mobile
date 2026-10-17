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
  // Name/nickname match like the server; an empty query returns the default list.
  (searchUsers as jest.Mock).mockImplementation(async ({ q }: { q: string }) => {
    const needle = q.trim().toLowerCase();
    return (users as { display_name: string; nickname: string }[]).filter(
      u => !needle || u.display_name.toLowerCase().includes(needle) || u.nickname.toLowerCase().includes(needle),
    );
  });
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

/** The shared picker's single search field (people and emails). */
export const searchField = (root: Instance): Instance =>
  root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search users');

/** Types into the search field and waits out the picker's debounce (tests use fake timers). */
export async function typeSearch(root: Instance, value: string): Promise<void> {
  await act(async () => {
    searchField(root).props.onChangeText(value);
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

/** Result rows of the picker. */
export const resultRows = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'user-search-row' && typeof n.props.onPress === 'function');

/** Taps the result row whose accessibility label contains `name`. */
export async function pickRow(root: Instance, name: string): Promise<void> {
  const row = resultRows(root).find(n => String(n.props.accessibilityLabel).includes(name));
  if (!row) throw new Error(`No result row for ${name}`);
  await press(row);
}

/** The "Invite <email>" button the picker shows for a valid email that matches nobody. */
export const emailButton = (root: Instance, email: string): Instance | undefined =>
  root.findAll(
    n => n.props.accessibilityLabel === `Invite ${email} as new player` && typeof n.props.onPress === 'function',
  )[0];

export const anyEmailButton = (root: Instance): boolean =>
  root.findAll(n => /^Invite .+@.+ as new /.test(String(n.props.accessibilityLabel ?? ''))).length > 0;
