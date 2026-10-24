/** AD-T11 (te-a1 item 5): the invite-group picker shows the group logo like the Groups list; initials when there is none. */
import React from 'react';

import { GroupInviteList } from '../AddRemoveControl';
import { renderAsync } from '../../test-utils/render';

const GROUPS = [
  { id: 'g1', name: 'Punggol Smashers', logo_url: 'https://cdn.example/g1.png' },
  { id: 'g2', name: 'Weekend Warriors', logo_url: null },
  { id: 'g3', name: 'Tue Tennis' },
];

describe('GroupInviteList', () => {
  it('shows the logo of a group that has one and the shared initials avatar for one that has not', async () => {
    const root = await renderAsync(<GroupInviteList groups={GROUPS} selectedIds={[]} onToggle={jest.fn()} />);
    const host = (id: string) => root.findAll(n => typeof n.type === 'string' && n.props.testID === id);
    const images = host('user-avatar-image');
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'https://cdn.example/g1.png' });
    expect(host('user-avatar-placeholder')).toHaveLength(2);
  });

  it('keeps the rows working: the name is shown and the control still stages the group', async () => {
    const onToggle = jest.fn();
    const root = await renderAsync(<GroupInviteList groups={GROUPS} selectedIds={[]} onToggle={onToggle} />);
    expect(root.findAll(n => (n.type as unknown) === 'Text').map(n => n.props.children)).toEqual(expect.arrayContaining(['Punggol Smashers']));
    const control = root.findAll(n => n.props.testID === 'group-invite-g1' && typeof n.props.onPress === 'function')[0];
    control.props.onPress();
    expect(onToggle).toHaveBeenCalledWith('g1');
  });
});
