/**
 * User details menu (design UM-T10): tap and long-press, View Details first, fail-closed card,
 * 404 notice, unknown keys, own avatar, no-card contexts, tap rules and the action registry.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { getEventPlayerCard, removeEventParticipant } from '../../../api/events';
import { getGroupMemberCard, removeMember } from '../../../api/groups';
import { closeUserMenu } from '../../../hooks/useUserMenu';
import { clearAccessNotice, isAccessNoticeShowing } from '../../../navigation/accessNotice';
import { act, pressableLabelled, renderAsync, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { UserCardOut } from '../../../types/userCard';
import UserMenuHost from '../UserMenuHost';
import UserPressable from '../UserPressable';

jest.mock('../../../api/groups', () => ({
  getGroupMemberCard: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
  transferGroupOwnership: jest.fn(),
}));
jest.mock('../../../api/events', () => ({
  getEventPlayerCard: jest.fn(),
  removeEventParticipant: jest.fn(),
}));
jest.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'viewer-1' } }),
}));

type PressableProps = Partial<React.ComponentProps<typeof UserPressable>>;

const mockGroupCard = getGroupMemberCard as jest.Mock;
const mockEventCard = getEventPlayerCard as jest.Mock;

const card = (keys: Array<string | { key: string; requires_approval: boolean }>, extra: Partial<UserCardOut> = {}): UserCardOut => ({
  user_id: 'u-1',
  display_name: 'Ravi Kumar',
  nickname: 'Ravi the Smash',
  photo_url: null,
  is_self: false,
  relation: 'admin',
  allowed_actions: keys.map(k => (typeof k === 'string' ? { key: k, requires_approval: false } : k)),
  ...extra,
});

const hosts: { onRowPress: jest.Mock; onChanged: jest.Mock } = { onRowPress: jest.fn(), onChanged: jest.fn() };

async function mount(props: PressableProps = {}): Promise<Instance> {
  return renderAsync(
    <View>
      <Pressable onPress={hosts.onRowPress} testID="row">
        <UserPressable
          userId="u-1"
          displayName="Ravi Kumar"
          nickname="Ravi the Smash"
          photoUrl={null}
          context={{ type: 'group', id: 'g-1' }}
          onChanged={hosts.onChanged}
          testID="person"
          {...props}
        >
          <Text>Ravi Kumar</Text>
        </UserPressable>
      </Pressable>
      <UserMenuHost />
    </View>,
  );
}

/** The Pressable that carries the press handlers for the person. */
const person = (root: Instance): Instance =>
  root.findAll(
    n =>
      n.props?.testID === 'person' &&
      (typeof n.props.onPress === 'function' || typeof n.props.onLongPress === 'function'),
  )[0];
const longPress = (root: Instance): Promise<void> => act(async () => person(root).props.onLongPress());
const tap = (root: Instance): Promise<void> => act(async () => person(root).props.onPress());
const has = (root: Instance, label: string): boolean =>
  root.findAll(n => n.props?.accessibilityRole === 'button' && n.props?.accessibilityLabel === label).length > 0;
const menuOpen = (root: Instance): boolean =>
  root.findAll(n => n.props?.testID === 'user-menu' && typeof n.type === 'string').length > 0;
const detailsOpen = (root: Instance): boolean =>
  root.findAll(n => n.props?.testID === 'user-details' && typeof n.type === 'string').length > 0;
const ACTIONS = ['Make admin', 'Remove admin', 'Make owner', 'Remove from group', 'Remove player'];
const shown = (root: Instance): string[] => ACTIONS.filter(label => has(root, label));

beforeEach(() => {
  act(() => closeUserMenu());
  clearAccessNotice();
  hosts.onRowPress = jest.fn();
  hosts.onChanged = jest.fn();
  mockGroupCard.mockReset().mockResolvedValue(card(['remove_admin']));
  mockEventCard.mockReset().mockResolvedValue(card(['remove_player'], { relation: 'player' }));
  (removeMember as jest.Mock).mockReset().mockResolvedValue(undefined);
  (removeEventParticipant as jest.Mock).mockReset().mockResolvedValue({});
});

describe('open', () => {
  it('long-press opens the menu with View Details first, then the server actions', async () => {
    mockGroupCard.mockResolvedValue(card(['remove_admin', 'make_owner', 'remove_from_group']));
    const root = await mount();
    await longPress(root);
    expect(menuOpen(root)).toBe(true);
    const order = root
      .findAll(n => typeof n.type === 'string' && n.props?.accessibilityRole === 'button' && ACTIONS.concat('View Details').includes(n.props?.accessibilityLabel))
      .map(n => n.props?.accessibilityLabel);
    expect(order).toEqual(['View Details', 'Remove admin', 'Make owner', 'Remove from group']);
  });

  it('fetches the card on every open, never from a cache', async () => {
    const root = await mount();
    await longPress(root);
    act(() => closeUserMenu());
    await longPress(root);
    expect(mockGroupCard).toHaveBeenCalledTimes(2);
  });

  it('View Details opens the details view: picture, display name, nickname', async () => {
    const root = await mount();
    await longPress(root);
    await act(async () => pressableLabelled(root, 'View Details').props.onPress());
    expect(detailsOpen(root)).toBe(true);
    expect(texts(root)).toEqual(expect.arrayContaining(['Details', 'Ravi Kumar', 'Ravi the Smash']));
  });

  it('a missing nickname shows the "No nickname" label', async () => {
    const root = await mount({ nickname: null });
    await tap(root);
    expect(texts(root)).toContain('No nickname');
  });

  it('a nickname the row does not carry shows nothing (no false "No nickname")', async () => {
    const root = await mount({ nickname: undefined });
    await tap(root);
    expect(texts(root)).not.toContain('No nickname');
  });
});

describe('tap rules', () => {
  it('a tap opens View Details, makes no card request and does not trigger the row action', async () => {
    const root = await mount();
    await tap(root);
    expect(detailsOpen(root)).toBe(true);
    expect(mockGroupCard).not.toHaveBeenCalled();
    expect(hosts.onRowPress).not.toHaveBeenCalled();
  });

  it('selectable rows: tap={false} leaves the tap to the row; long-press still opens the menu', async () => {
    const root = await mount({ tap: false });
    expect(person(root).props.onPress).toBeUndefined();
    await longPress(root);
    expect(menuOpen(root)).toBe(true);
  });

  it('22 px home-card avatars: longPress={false} is tap only and opens View Details with no card request', async () => {
    const root = await mount({ longPress: false, context: { type: 'none' } });
    expect(person(root).props.onLongPress).toBeUndefined();
    await tap(root);
    expect(detailsOpen(root)).toBe(true);
    expect(mockGroupCard).not.toHaveBeenCalled();
    expect(mockEventCard).not.toHaveBeenCalled();
  });

  it('long-press uses the 350 ms delay', async () => {
    const root = await mount();
    expect(person(root).props.delayLongPress).toBe(350);
  });
});

describe('fail closed', () => {
  it('a failed card leaves View Details only and shows the load message', async () => {
    mockGroupCard.mockRejectedValue(new Error('boom'));
    const root = await mount();
    await longPress(root);
    expect(has(root, 'View Details')).toBe(true);
    expect(shown(root)).toEqual([]);
    expect(texts(root)).toContain('Could not load options.');
  });

  it('a card timeout is a failure: the request carries a timeout', async () => {
    const root = await mount();
    await longPress(root);
    expect(mockGroupCard.mock.calls[0][2]).toEqual(expect.objectContaining({ timeoutMs: 8000 }));
  });

  it('a 404 closes the menu, shows the no-longer-available notice and refetches the host', async () => {
    mockGroupCard.mockRejectedValue({ response: { status: 404 } });
    const root = await mount();
    await longPress(root);
    expect(menuOpen(root)).toBe(false);
    expect(isAccessNoticeShowing()).toBe(true);
    expect(hosts.onChanged).toHaveBeenCalledTimes(1);
  });

  it('an unknown action key is ignored, as is a key from another context', async () => {
    mockGroupCard.mockResolvedValue(card(['teleport', 'remove_player', 'remove_from_group']));
    const root = await mount();
    await longPress(root);
    expect(shown(root)).toEqual(['Remove from group']);
  });

  it('a requires_approval action is never offered (none exist in v1)', async () => {
    mockGroupCard.mockResolvedValue(card([{ key: 'remove_from_group', requires_approval: true }, 'make_owner']));
    const root = await mount();
    await longPress(root);
    expect(shown(root)).toEqual(['Make owner']);
  });

  it('is_self from the server hides every action', async () => {
    mockGroupCard.mockResolvedValue(card(['make_owner'], { is_self: true }));
    const root = await mount();
    await longPress(root);
    expect(shown(root)).toEqual([]);
  });

  it('own avatar: View Details only and no card request', async () => {
    const root = await mount({ userId: 'viewer-1' });
    await longPress(root);
    expect(mockGroupCard).not.toHaveBeenCalled();
    expect(has(root, 'View Details')).toBe(true);
    expect(shown(root)).toEqual([]);
  });

  it.each([['tournament'], ['none']] as const)('context %s: View Details from row data, no card request, no actions', async type => {
    const root = await mount({ context: { type, id: 't-1' } });
    await longPress(root);
    expect(mockGroupCard).not.toHaveBeenCalled();
    expect(mockEventCard).not.toHaveBeenCalled();
    expect(has(root, 'View Details')).toBe(true);
    expect(shown(root)).toEqual([]);
  });

  it('a person with no user id gets View Details from the row and no card request', async () => {
    const root = await mount({ userId: null, noUser: true });
    await longPress(root);
    expect(mockGroupCard).not.toHaveBeenCalled();
    expect(has(root, 'View Details')).toBe(true);
  });
});

describe('actions', () => {
  it('a game person: remove_player confirms, then calls the organiser remove endpoint with the card correlation id', async () => {
    const root = await mount({ context: { type: 'game', id: 'e-1' } });
    await longPress(root);
    expect(mockEventCard).toHaveBeenCalledWith('e-1', 'u-1', expect.objectContaining({ correlationId: expect.any(String) }));
    await act(async () => pressableLabelled(root, 'Remove player').props.onPress());
    expect(texts(root)).toContain('Remove Ravi Kumar from this game?');
    expect(removeEventParticipant).not.toHaveBeenCalled();
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    const cardId = mockEventCard.mock.calls[0][2].correlationId;
    expect(removeEventParticipant).toHaveBeenCalledWith('e-1', 'u-1', { correlationId: cardId });
    expect(hosts.onChanged).toHaveBeenCalledTimes(1);
    expect(texts(root)).toContain('Done');
    expect(menuOpen(root)).toBe(false);
  });

  it('Cancel on the confirmation returns to the menu and calls nothing', async () => {
    mockGroupCard.mockResolvedValue(card(['remove_from_group']));
    const root = await mount();
    await longPress(root);
    await act(async () => pressableLabelled(root, 'Remove from group').props.onPress());
    await act(async () => pressableLabelled(root, 'Cancel').props.onPress());
    expect(menuOpen(root)).toBe(true);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it('an action that now 404s closes with the notice and refetches the host', async () => {
    mockGroupCard.mockResolvedValue(card(['remove_from_group']));
    (removeMember as jest.Mock).mockRejectedValue({ response: { status: 404 } });
    const root = await mount();
    await longPress(root);
    await act(async () => pressableLabelled(root, 'Remove from group').props.onPress());
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    expect(isAccessNoticeShowing()).toBe(true);
    expect(hosts.onChanged).toHaveBeenCalledTimes(1);
    expect(menuOpen(root)).toBe(false);
  });

  it('a refusal shows the server message (or the generic one for a server error) and refreshes', async () => {
    mockGroupCard.mockResolvedValue(card(['remove_from_group']));
    (removeMember as jest.Mock).mockRejectedValue({ response: { status: 500 } });
    const root = await mount();
    await longPress(root);
    await act(async () => pressableLabelled(root, 'Remove from group').props.onPress());
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    expect(texts(root)).toContain('Could not complete this action. Please try again.');
    expect(hosts.onChanged).toHaveBeenCalledTimes(1);
  });
});
