import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

import { render } from '../../../test-utils/render';
import {
  REGISTRY_CONFIG,
  RegistryIcon,
  type RegistryIconName,
} from '../RegistryIcons';
import {
  CancelledIcon,
  MarkUnreadIcon,
  OwnerIcon,
  PlayerRemovedIcon,
} from '../ActionIcons';
import { NotificationIcon } from '../NotificationIcon';

describe('RegistryIcon', () => {
  const iconNames: RegistryIconName[] = [
    'time',
    'edit',
    'players',
    'success',
    'add',
    'cancelled',
    'player-removed',
    'owner',
    'delete',
    'notifications',
    'mark-unread',
  ];

  it.each(iconNames)('renders registry icon %s with SVG', name => {
    const rendered = render(<RegistryIcon name={name} size={44} />);
    const svgs = rendered.findAllByType(Svg);
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders default gradient tile at 44x44', () => {
    const rendered = render(<RegistryIcon name="time" size={44} />);
    const views = rendered.findAllByType(View);
    const wrapper = views[0];
    const style = StyleSheet.flatten(wrapper.props.style);
    expect(style.width).toBe(44);
    expect(style.height).toBe(44);
  });
});

describe('ActionIcons', () => {
  it('renders the 4 new icons from image 09 glyphs', () => {
    expect(render(<CancelledIcon size={20} color="#DC2626" />).findAllByType(Svg)).toHaveLength(1);
    expect(render(<PlayerRemovedIcon size={20} color="#EA580C" />).findAllByType(Svg)).toHaveLength(1);
    expect(render(<OwnerIcon size={20} color="#D97706" />).findAllByType(Svg)).toHaveLength(1);
    expect(render(<MarkUnreadIcon size={20} color="#62718F" />).findAllByType(Svg)).toHaveLength(1);
  });
});

describe('NotificationIcon', () => {
  it('renders full color with shadow for unread notifications', () => {
    const rendered = render(
      <NotificationIcon type="event_cancelled" read={false} />,
    );
    const wrapper = rendered.findAllByType(View)[0];
    const style = StyleSheet.flatten(wrapper.props.style);
    expect(style.opacity).toBe(1);
    expect(style.shadowOpacity).toBe(0.15);
  });

  it('renders 60% opacity with no shadow for read notifications', () => {
    const rendered = render(
      <NotificationIcon type="event_cancelled" read={true} />,
    );
    const wrapper = rendered.findAllByType(View)[0];
    const style = StyleSheet.flatten(wrapper.props.style);
    expect(style.opacity).toBe(0.6);
    expect(style.shadowOpacity).toBeUndefined();
  });

  it('falls back to notifications icon for unknown notification type', () => {
    const rendered = render(
      <NotificationIcon type="unknown_future_type" read={false} />,
    );
    expect(rendered.findAllByType(Svg).length).toBeGreaterThan(0);
  });
});
