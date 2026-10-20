/**
 * The 22 px home-card avatars (design UM-06, board M7): a tap opens View Details from the card's
 * own data (no card request, no long-press) and does not trigger the card's own action.
 */
import React from 'react';

import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import { UnifiedCard } from '../UnifiedCard';

jest.mock('../../../api/groups', () => ({ getGroupMemberCard: jest.fn() }));
jest.mock('../../../api/events', () => ({ getEventPlayerCard: jest.fn() }));

const avatars = [
  { display_name: 'Mei Lin', photo_url: null, user_id: 'u-mei' },
  { display_name: 'Arjun S', photo_url: null, user_id: 'u-arjun' },
];

function mount(onPress = jest.fn()): { root: Instance; onPress: jest.Mock } {
  const root = render(
    <UnifiedCard
      leftTile={null}
      title="Sunday Doubles"
      details={null}
      avatars={avatars}
      moreCount={5}
      countLabel="7 going"
      actionButtonLabel="View"
      onPress={onPress}
      accessibilityLabel="Sunday Doubles"
    />,
  );
  return { root, onPress };
}

const avatarPressables = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'card-avatar' && typeof n.props.onPress === 'function');

it('each avatar is its own tap target, with tap only (no long-press)', () => {
  const { root } = mount();
  const nodes = avatarPressables(root);
  expect(nodes).toHaveLength(2);
  nodes.forEach(node => expect(node.props.onLongPress).toBeUndefined());
});

it('a tap opens View Details with that person, makes no card request and does not trigger the card', async () => {
  const { root, onPress } = mount();
  await act(async () => avatarPressables(root)[1].props.onPress());
  expect(root.findAll(n => n.props.testID === 'user-menu-details')).toHaveLength(1);
  expect(texts(root)).toEqual(expect.arrayContaining(['Details', 'Arjun S']));
  expect(onPress).not.toHaveBeenCalled();
  const { getGroupMemberCard } = jest.requireMock('../../../api/groups');
  const { getEventPlayerCard } = jest.requireMock('../../../api/events');
  expect(getGroupMemberCard).not.toHaveBeenCalled();
  expect(getEventPlayerCard).not.toHaveBeenCalled();
});
