/**
 * User details menu (design DES-MEETUP-ADDENDUM-user-details-menu.md UM-T10): `useUserMenu`,
 * `UserMenuSheet` and `UserPressable` through a small host, with only `src/api` mocked.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { getEventPlayerCard, removeEventPlayer } from '../../../api/events';
import {
  getGroupMemberCard,
  removeMember,
  transferGroupOwnership,
  updateMemberRole,
} from '../../../api/groups';
import { CARD_TIMEOUT_MS, useUserMenu } from '../../../hooks/useUserMenu';
import { clearAccessNotice, isAccessNoticeShowing } from '../../../navigation/accessNotice';
import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { UserCardOut, UserIdentity, UserMenuContext } from '../../../types/userMenu';
import UserMenuSheet from '../UserMenuSheet';
import UserPressable from '../UserPressable';

jest.mock('../../../api/groups', () => ({
  getGroupMemberCard: jest.fn(),
  removeMember: jest.fn(),
  transferGroupOwnership: jest.fn(),
  updateMemberRole: jest.fn(),
}));
jest.mock('../../../api/events', () => ({
  getEventPlayerCard: jest.fn(),
  removeEventPlayer: jest.fn(),
}));

const RAVI: UserIdentity = { userId: 'u-ravi', displayName: 'Ravi Kumar', nickname: 'Ravi the Smash', photoUrl: null };
const SELF: UserIdentity = { userId: 'me', displayName: 'Sam Lee', nickname: 'sam', photoUrl: null };
const NO_NICK: UserIdentity = { userId: 'u-x', displayName: 'No Nick', nickname: null, photoUrl: null };

const card = (over: Partial<UserCardOut> = {}): UserCardOut => ({
  user_id: 'u-ravi',
  display_name: 'Ravi Kumar',
  nickname: 'Ravi the Smash',
  photo_url: null,
  is_self: false,
  relation: 'admin',
  allowed_actions: [],
  ...over,
});
const allow = (...keys: string[]) => keys.map(key => ({ key, requires_approval: false }));

function Host({
  context,
  people = [RAVI],
  onChanged,
  onRowPress,
  tap,
  longPress,
}: {
  context: UserMenuContext;
  people?: UserIdentity[];
  onChanged?: () => void;
  onRowPress?: (id: string | null) => void;
  tap?: 'details' | 'none';
  longPress?: boolean;
}): React.JSX.Element {
  const menu = useUserMenu({ context, currentUserId: 'me', onChanged });
  return (
    <View>
      {people.map(person => (
        <Pressable
          key={person.displayName}
          testID={`row-${person.displayName}`}
          onPress={() => onRowPress?.(person.userId)}
        >
          <UserPressable person={person} menu={menu} tap={tap} longPress={longPress} testID={`who-${person.displayName}`}>
            <Text>{person.displayName}</Text>
          </UserPressable>
        </Pressable>
      ))}
      <UserMenuSheet menu={menu} />
    </View>
  );
}

/** The inner Pressable of the person (the node that carries the handlers). */
const who = (root: Instance, name = 'Ravi Kumar'): Instance =>
  root.find(
    n =>
      n.props.testID === `who-${name}` &&
      (typeof n.props.onPress === 'function' || typeof n.props.onLongPress === 'function'),
  );
const byId = (root: Instance, testID: string): Instance[] => root.findAll(n => n.props.testID === testID);
const sheetOpen = (root: Instance): boolean => byId(root, 'user-menu-sheet').length > 0;
const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};
const longPress = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onLongPress();
  });
};
const actionKeys = (root: Instance): string[] =>
  root
    .findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('user-menu-action-') && typeof n.props.onPress === 'function')
    .map(n => String(n.props.testID).replace('user-menu-action-', ''));

const GROUP: UserMenuContext = { type: 'group', id: 'g-1' };
const GAME: UserMenuContext = { type: 'game', id: 'e-1' };

beforeEach(() => {
  clearAccessNotice();
  (getGroupMemberCard as jest.Mock).mockReset().mockResolvedValue(card());
  (getEventPlayerCard as jest.Mock).mockReset().mockResolvedValue(card({ relation: 'player' }));
  (removeMember as jest.Mock).mockReset().mockResolvedValue(undefined);
  (transferGroupOwnership as jest.Mock).mockReset().mockResolvedValue(undefined);
  (updateMemberRole as jest.Mock).mockReset().mockResolvedValue(undefined);
  (removeEventPlayer as jest.Mock).mockReset().mockResolvedValue({});
});

describe('tap and long-press (UM-06)', () => {
  it('avatar tap opens View Details, makes no card request and does not trigger the row action', async () => {
    const onRowPress = jest.fn();
    const root = render(<Host context={GROUP} onRowPress={onRowPress} />);
    await press(who(root));
    expect(byId(root, 'user-menu-details').length).toBeGreaterThan(0);
    expect(texts(root)).toEqual(expect.arrayContaining(['Details', 'Ravi Kumar', 'Ravi the Smash', 'Close']));
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    expect(onRowPress).not.toHaveBeenCalled();
  });

  it('long-press opens the menu with View Details first, then only the server actions', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(
      card({ allowed_actions: allow('remove_admin', 'make_owner', 'remove_from_group') }),
    );
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    const ids = root
      .findAll(
        n =>
          n.props.accessibilityRole === 'button' &&
          typeof n.props.testID === 'string' &&
          n.props.testID.startsWith('user-menu-') &&
          typeof n.props.onPress === 'function',
      )
      .map(n => n.props.testID as string);
    expect(ids[0]).toBe('user-menu-view-details');
    expect(actionKeys(root)).toEqual(['remove_admin', 'make_owner', 'remove_from_group']);
    expect(texts(root)).toEqual(expect.arrayContaining(['View Details', 'Remove admin', 'Make owner', 'Remove from group']));
    expect(getGroupMemberCard).toHaveBeenCalledWith('g-1', 'u-ravi', expect.objectContaining({ correlationId: expect.any(String) }));
  });

  it('View Details item switches the sheet to the details view', async () => {
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-view-details')[0]);
    expect(byId(root, 'user-menu-details').length).toBeGreaterThan(0);
  });

  it('selectable rows: the avatar gets long-press only, so a tap stays with the row', () => {
    const root = render(<Host context={{ type: 'none' }} tap="none" />);
    const node = root.find(n => n.props.testID === 'who-Ravi Kumar' && typeof n.props.onLongPress === 'function');
    expect(node.props.onPress).toBeUndefined();
    expect(typeof node.props.onLongPress).toBe('function');
    expect(node.props.delayLongPress).toBe(350);
  });

  it('22 px home-card avatars: tap only, no long-press', () => {
    const root = render(<Host context={{ type: 'none' }} longPress={false} />);
    const node = root.find(n => n.props.testID === 'who-Ravi Kumar' && typeof n.props.onPress === 'function');
    expect(node.props.onLongPress).toBeUndefined();
  });

  it('every person pressable uses a 350 ms long-press', () => {
    const root = render(<Host context={GROUP} />);
    expect(who(root).props.delayLongPress).toBe(350);
  });
});

describe('fail closed (AD-5)', () => {
  it('shows View Details at once, with a loading state, before the card arrives', async () => {
    let resolve!: (c: UserCardOut) => void;
    (getGroupMemberCard as jest.Mock).mockReturnValue(new Promise<UserCardOut>(r => (resolve = r)));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    expect(byId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
    expect(byId(root, 'user-menu-loading').length).toBeGreaterThan(0);
    expect(actionKeys(root)).toEqual([]);
    await act(async () => {
      resolve(card({ allowed_actions: allow('make_owner') }));
    });
    expect(actionKeys(root)).toEqual(['make_owner']);
  });

  it('a card failure leaves View Details only and shows "Could not load options."', async () => {
    (getGroupMemberCard as jest.Mock).mockRejectedValue(new Error('boom'));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    expect(actionKeys(root)).toEqual([]);
    expect(byId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
    expect(texts(root)).toContain('Could not load options.');
  });

  it('a 5xx card failure is the same as any failure: no actions', async () => {
    (getGroupMemberCard as jest.Mock).mockRejectedValue({ response: { status: 500 } });
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    expect(actionKeys(root)).toEqual([]);
  });

  it('a card that does not answer in time counts as failed', async () => {
    jest.useFakeTimers();
    try {
      (getGroupMemberCard as jest.Mock).mockReturnValue(new Promise(() => undefined));
      const root = render(<Host context={GROUP} />);
      await longPress(who(root));
      await act(async () => {
        jest.advanceTimersByTime(CARD_TIMEOUT_MS + 1);
      });
      expect(actionKeys(root)).toEqual([]);
      expect(texts(root)).toContain('Could not load options.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('a 404 closes the menu, shows the "no longer available" notice and asks the host to refetch', async () => {
    (getGroupMemberCard as jest.Mock).mockRejectedValue({ response: { status: 404 } });
    const onChanged = jest.fn();
    const root = render(<Host context={GROUP} onChanged={onChanged} />);
    await longPress(who(root));
    expect(sheetOpen(root)).toBe(false);
    expect(isAccessNoticeShowing()).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('an unknown action key is ignored; so is anything that asks for approval', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(
      card({
        allowed_actions: [
          { key: 'teleport', requires_approval: false },
          { key: 'make_owner', requires_approval: true },
          { key: 'make_admin', requires_approval: false },
        ],
      }),
    );
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    expect(actionKeys(root)).toEqual(['make_admin']);
  });

  it('a game action key in a group context is not offered (keys are checked against the context)', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('remove_player', 'make_admin') }));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    expect(actionKeys(root)).toEqual(['make_admin']);
  });

  it('own avatar: View Details only, no card request', async () => {
    const root = render(<Host context={GROUP} people={[SELF]} />);
    await longPress(who(root, 'Sam Lee'));
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    expect(byId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
    expect(actionKeys(root)).toEqual([]);
  });

  it('even if the server marks the card as self, no actions show', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ is_self: true, allowed_actions: allow('remove_from_group') }));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    expect(actionKeys(root)).toEqual([]);
  });

  it.each([['tournament' as const], ['none' as const]])(
    'context %s: View Details from the row, no card request, no actions',
    async type => {
      const root = render(<Host context={{ type, id: 't-1' }} />);
      await longPress(who(root));
      expect(getGroupMemberCard).not.toHaveBeenCalled();
      expect(getEventPlayerCard).not.toHaveBeenCalled();
      expect(byId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
      expect(actionKeys(root)).toEqual([]);
    },
  );

  it('a person with no user id (registration without a linked user) never requests a card', async () => {
    const coach: UserIdentity = { userId: null, displayName: 'Coach Tan', photoUrl: null };
    const root = render(<Host context={GROUP} people={[coach]} />);
    await longPress(who(root, 'Coach Tan'));
    expect(getGroupMemberCard).not.toHaveBeenCalled();
  });

  it('fetches the card on every open (no cache)', async () => {
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-view-details')[0]);
    await press(byId(root, 'user-menu-close')[0]);
    await longPress(who(root));
    expect(getGroupMemberCard).toHaveBeenCalledTimes(2);
  });
});

describe('details view', () => {
  it('shows the "No nickname" label when there is no nickname', async () => {
    const root = render(<Host context={{ type: 'none' }} people={[NO_NICK]} />);
    await press(who(root, 'No Nick'));
    expect(texts(root)).toContain('No nickname');
  });

  it('leaves the nickname line out when the row does not carry one at all', async () => {
    const mei: UserIdentity = { userId: 'u-m', displayName: 'Mei Lin', photoUrl: null };
    const root = render(<Host context={{ type: 'none' }} people={[mei]} />);
    await press(who(root, 'Mei Lin'));
    expect(texts(root)).not.toContain('No nickname');
  });

  it('Close closes the sheet', async () => {
    const root = render(<Host context={{ type: 'none' }} />);
    await press(who(root));
    await press(byId(root, 'user-menu-close')[0]);
    expect(sheetOpen(root)).toBe(false);
  });
});

describe('actions', () => {
  it('Remove from group asks first, runs through removeMember with the card fetch correlation id, then refreshes the host and says Done', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('remove_from_group') }));
    const onChanged = jest.fn();
    const root = render(<Host context={GROUP} onChanged={onChanged} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-remove_from_group')[0]);
    expect(removeMember).not.toHaveBeenCalled();
    expect(texts(root)).toEqual(expect.arrayContaining(['Are you sure?', 'Remove Ravi Kumar from this group?', 'Cancel', 'Yes']));
    await press(byId(root, 'user-menu-confirm-yes')[0]);
    expect(removeMember).toHaveBeenCalledTimes(1);
    const cardCorrelation = (getGroupMemberCard as jest.Mock).mock.calls[0][2].correlationId;
    expect(removeMember).toHaveBeenCalledWith('g-1', 'u-ravi', { correlationId: cardCorrelation });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(sheetOpen(root)).toBe(false);
    expect(texts(root)).toContain('Done');
  });

  it('Cancel in the confirmation runs nothing and returns to the menu', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('remove_from_group') }));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-remove_from_group')[0]);
    await press(byId(root, 'user-menu-confirm-cancel')[0]);
    expect(removeMember).not.toHaveBeenCalled();
    expect(actionKeys(root)).toEqual(['remove_from_group']);
  });

  it('Make admin and Remove admin set the role through updateMemberRole', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('make_admin', 'remove_admin') }));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-make_admin')[0]);
    expect(updateMemberRole).toHaveBeenLastCalledWith('g-1', 'u-ravi', 'admin', expect.anything());
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-remove_admin')[0]);
    expect(updateMemberRole).toHaveBeenLastCalledWith('g-1', 'u-ravi', 'member', expect.anything());
  });

  it('Make owner asks first, then calls transferGroupOwnership', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('make_owner') }));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-make_owner')[0]);
    expect(texts(root)).toContain('Make Ravi Kumar the owner of this group?');
    await press(byId(root, 'user-menu-confirm-yes')[0]);
    expect(transferGroupOwnership).toHaveBeenCalledWith('g-1', 'u-ravi', expect.anything());
  });

  it('game context: card from the events endpoint; Remove player asks first, then removeEventPlayer', async () => {
    (getEventPlayerCard as jest.Mock).mockResolvedValue(card({ relation: 'player', allowed_actions: allow('remove_player') }));
    const root = render(<Host context={GAME} />);
    await longPress(who(root));
    expect(getEventPlayerCard).toHaveBeenCalledWith('e-1', 'u-ravi', expect.anything());
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    await press(byId(root, 'user-menu-action-remove_player')[0]);
    expect(texts(root)).toContain('Remove Ravi Kumar from this game?');
    await press(byId(root, 'user-menu-confirm-yes')[0]);
    expect(removeEventPlayer).toHaveBeenCalledWith('e-1', 'u-ravi', expect.objectContaining({ correlationId: expect.any(String) }));
  });

  it('a refusal shows the server message and still refreshes the host', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('make_admin') }));
    (updateMemberRole as jest.Mock).mockRejectedValue({ response: { status: 403, data: { detail: 'Only owners can do that' } } });
    const onChanged = jest.fn();
    const root = render(<Host context={GROUP} onChanged={onChanged} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-make_admin')[0]);
    expect(texts(root)).toContain('Only owners can do that');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(sheetOpen(root)).toBe(false);
  });

  it('a failure without a server message shows "Could not complete this action. Please try again."', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('make_admin') }));
    (updateMemberRole as jest.Mock).mockRejectedValue(new Error('network'));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-make_admin')[0]);
    expect(texts(root)).toContain('Could not complete this action. Please try again.');
  });

  it('a 404 from the action closes the menu with the notice and refreshes the host', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('make_admin') }));
    (updateMemberRole as jest.Mock).mockRejectedValue({ response: { status: 404 } });
    const onChanged = jest.fn();
    const root = render(<Host context={GROUP} onChanged={onChanged} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-make_admin')[0]);
    expect(isAccessNoticeShowing()).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('a double tap on Yes runs the action once', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card({ allowed_actions: allow('remove_from_group') }));
    let finish!: () => void;
    (removeMember as jest.Mock).mockReturnValue(new Promise<void>(r => (finish = r)));
    const root = render(<Host context={GROUP} />);
    await longPress(who(root));
    await press(byId(root, 'user-menu-action-remove_from_group')[0]);
    const yes = byId(root, 'user-menu-confirm-yes')[0];
    await act(async () => {
      yes.props.onPress();
      yes.props.onPress();
    });
    await act(async () => finish());
    expect(removeMember).toHaveBeenCalledTimes(1);
  });
});
