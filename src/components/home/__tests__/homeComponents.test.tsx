/**
 * Dashboard components. Every test EXECUTES a real render (react-test-renderer)
 * and asserts on the rendered tree / props; none reads source text. Layout is
 * not computed by the test renderer, so the "spread vs scroll" case asserts
 * the style props that produce it (flagged in the case name).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeEvent } from '../../../test-utils/makeEvent';
import { act, pressableLabelled, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import { dash, dashRadius, dashSize } from '../../../theme/dashboardTheme';
import type { Group } from '../../../types/group';
import { FootballIcon, GroupsIcon, SportIcon } from '../../icons/DashboardIcons';
import DashboardBanner from '../DashboardBanner';
import GameRow from '../GameRow';
import GroupRow from '../GroupRow';
import NextGameCard from '../NextGameCard';
import ShortcutTiles from '../ShortcutTiles';
import SportChipsRow from '../SportChipsRow';
import { EmptyText, InlineError, SectionHeader, SkeletonRows } from '../SectionParts';

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function banner(props: Partial<React.ComponentProps<typeof DashboardBanner>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DashboardBanner
        name="Sam Smith"
        photoUrl={null}
        unreadCount={0}
        onBellPress={jest.fn()}
        onAvatarPress={jest.fn()}
        {...props}
      />
    </SafeAreaProvider>,
  );
}

const flat = (node: Instance) => {
  const style = node.props.style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);
};

/** Host (native) nodes with this testID — avoids matching composite wrappers too. */
const hostsByTestId = (root: Instance, testID: string): Instance[] =>
  root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
/** Nearest ancestor that is a host (native) node. */
const hostParent = (node: Instance): Instance => {
  let current = node.parent as Instance;
  while (typeof current.type !== 'string') {
    current = current.parent as Instance;
  }
  return current;
};
const hostByTestId = (root: Instance, testID: string): Instance => {
  const found = hostsByTestId(root, testID);
  if (found.length !== 1) {
    throw new Error(`Expected one host node with testID ${testID}, found ${found.length}`);
  }
  return found[0];
};

describe('DashboardBanner', () => {
  it('greets with plain text "Good to see you" (no emoji) and "Ready to play, {name}?"', () => {
    const all = texts(banner());
    expect(all).toContain('Good to see you');
    expect(all).toContain('Ready to play, Sam Smith?');
    expect(all.join(' ')).not.toMatch(/👋|\p{Extended_Pictographic}/u);
  });

  it('drops the name from the headline when there is none', () => {
    expect(texts(banner({ name: '  ' }))).toContain('Ready to play?');
  });

  it('shows the app icon at 34x34 in a 46x46 white tile with a 14px radius and no name text', () => {
    const root = banner();
    const icon = hostByTestId(root, 'banner-app-icon');
    expect(flat(icon)).toMatchObject({ width: 34, height: 34 });
    const tile = hostParent(icon);
    expect(flat(tile)).toMatchObject({
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
    });
    expect(texts(root).join(' ')).not.toMatch(/meetup|shuttlr/i);
  });

  it('uses the brand banner at height 208 plus the status-bar inset with 32px bottom corners', () => {
    const style = flat(hostByTestId(banner(), 'dashboard-banner'));
    expect(style).toMatchObject({
      backgroundColor: dash.brand,
      height: dashSize.bannerHeight + 24,
      borderBottomLeftRadius: dashRadius.bannerBottom,
      borderBottomRightRadius: dashRadius.bannerBottom,
    });
  });

  it('hides the bell badge at zero and shows the count (capped at 99+) otherwise', () => {
    expect(hostsByTestId(banner({ unreadCount: 0 }), 'notification-badge')).toHaveLength(0);
    const root = banner({ unreadCount: 3 });
    expect(texts(hostByTestId(root, 'notification-badge'))).toEqual(['3']);
    expect(pressableLabelled(root, 'Notifications, 3 unread')).toBeDefined();
    expect(texts(hostByTestId(banner({ unreadCount: 250 }), 'notification-badge'))).toEqual([
      '99+',
    ]);
  });

  it('shows the uploaded photo (48px, 2px white ring) when a URL exists', () => {
    const root = banner({ photoUrl: 'https://cdn.example/a.jpg' });
    const photo = hostByTestId(root, 'banner-avatar-photo');
    expect(photo.props.source).toEqual({ uri: 'https://cdn.example/a.jpg' });
    expect(hostsByTestId(root, 'banner-avatar-letter')).toHaveLength(0);
    const ring = hostParent(photo);
    expect(flat(ring)).toMatchObject({ width: 48, height: 48, borderWidth: 2, borderColor: '#FFFFFF' });
  });

  it('falls back to the letter avatar when there is no photo', () => {
    const root = banner({ photoUrl: null });
    expect(hostsByTestId(root, 'banner-avatar-photo')).toHaveLength(0);
    expect(texts(hostByTestId(root, 'banner-avatar-letter'))).toEqual(['S']);
  });

  it('falls back to the letter avatar when the image fails to load', () => {
    const root = banner({ photoUrl: 'https://cdn.example/broken.jpg' });
    act(() => {
      hostByTestId(root, 'banner-avatar-photo').props.onError();
    });
    expect(hostsByTestId(root, 'banner-avatar-photo')).toHaveLength(0);
    expect(hostsByTestId(root, 'banner-avatar-letter')).toHaveLength(1);
  });

  it('routes the bell and the avatar presses', () => {
    const onBellPress = jest.fn();
    const onAvatarPress = jest.fn();
    const root = banner({ onBellPress, onAvatarPress });
    act(() => pressableLabelled(root, 'Notifications').props.onPress());
    act(() => pressableLabelled(root, 'Profile').props.onPress());
    expect(onBellPress).toHaveBeenCalledTimes(1);
    expect(onAvatarPress).toHaveBeenCalledTimes(1);
  });
});

describe('SportChipsRow', () => {
  const options = [
    { key: 'badminton', label: 'Badminton', slug: 'badminton' },
    { key: 'curling', label: 'Curling', slug: 'curling' },
  ];

  it('renders All first, then one chip per sport, as buttons', () => {
    const root = render(<SportChipsRow options={options} selected={[]} onToggle={jest.fn()} />);
    const labels = root
      .findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .map(node => node.props.accessibilityLabel);
    expect(labels).toEqual(['All', 'Badminton', 'Curling']);
  });

  it('marks All selected when nothing is, and only the chosen sports otherwise', () => {
    const none = render(<SportChipsRow options={options} selected={[]} onToggle={jest.fn()} />);
    expect(pressableLabelled(none, 'All').props.accessibilityState).toEqual({ selected: true });
    expect(pressableLabelled(none, 'Badminton').props.accessibilityState).toEqual({ selected: false });

    const some = render(
      <SportChipsRow options={options} selected={['badminton']} onToggle={jest.fn()} />,
    );
    expect(pressableLabelled(some, 'All').props.accessibilityState).toEqual({ selected: false });
    expect(pressableLabelled(some, 'Badminton').props.accessibilityState).toEqual({ selected: true });
  });

  it('draws a 2px brand ring on a selected chip only', () => {
    const root = render(
      <SportChipsRow options={options} selected={['badminton']} onToggle={jest.fn()} />,
    );
    const rings = hostsByTestId(root, 'sport-chip-ring');
    expect(rings).toHaveLength(1);
    expect(flat(rings[0])).toMatchObject({ borderWidth: 2, borderColor: dash.brand });
  });

  it('reports taps: sport key for a chip, null for All', () => {
    const onToggle = jest.fn();
    const root = render(<SportChipsRow options={options} selected={[]} onToggle={onToggle} />);
    act(() => pressableLabelled(root, 'Badminton').props.onPress());
    act(() => pressableLabelled(root, 'All').props.onPress());
    expect(onToggle.mock.calls).toEqual([['badminton'], [null]]);
  });

  it('shows an unknown sport with the fallback icon and a known one with its own', () => {
    const root = render(<SportChipsRow options={options} selected={[]} onToggle={jest.fn()} />);
    expect(root.findAllByType(SportIcon).map(node => node.props.slug)).toEqual(['badminton', 'curling']);
  });

  it('applies the spread-or-scroll layout: horizontal scroller whose content grows to fill and spaces between (props only; layout engine not run)', () => {
    const root = render(<SportChipsRow options={options} selected={[]} onToggle={jest.fn()} />);
    const scroll = hostByTestId(root, 'sport-chips-scroll');
    expect(scroll.props.horizontal).toBe(true);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      justifyContent: 'space-between',
    });
  });

  it('shows skeleton tiles while the admin list loads', () => {
    const root = render(
      <SportChipsRow options={[]} selected={[]} onToggle={jest.fn()} isLoading />,
    );
    expect(hostsByTestId(root, 'sport-chips-loading')).toHaveLength(1);
  });
});

describe('GameRow', () => {
  const event = makeEvent({
    title: 'Friday doubles',
    sport: 'Football',
    venue_name: 'Riverside',
    participant_count: 5,
    capacity: 12,
    starts_at: '2030-01-04T18:00:00Z',
  });

  it('shows the title, venue, going count, and the sport icon by slug', () => {
    const root = render(<GameRow event={event} onPress={jest.fn()} />);
    const all = texts(root);
    expect(all).toContain('Friday doubles');
    expect(all).toContain('5/12 going');
    expect(all.some(text => text.includes('Riverside'))).toBe(true);
    expect(root.findAllByType(SportIcon)[0].props.slug).toBe('Football');
    expect(root.findAllByType(FootballIcon)).toHaveLength(1);
  });

  it('shows no status badge on Home, and the given badge on the Games screen', () => {
    expect(texts(render(<GameRow event={event} onPress={jest.fn()} />))).not.toContain('Open');
    expect(texts(render(<GameRow event={event} badge="Open" onPress={jest.fn()} />))).toContain('Open');
    expect(texts(render(<GameRow event={event} badge="Waitlisted" onPress={jest.fn()} />))).toContain(
      'Waitlisted',
    );
  });

  it('uses the fallback icon for an unknown sport', () => {
    const root = render(<GameRow event={makeEvent({ sport: 'curling' })} onPress={jest.fn()} />);
    expect(root.findAllByType(FootballIcon)).toHaveLength(0);
    expect(root.findAllByType(SportIcon)[0].props.slug).toBe('curling');
  });

  it('is a button with at least a 44px target that fires onPress', () => {
    const onPress = jest.fn();
    const root = render(<GameRow event={event} onPress={onPress} />);
    const button = root.find(node => node.props.accessibilityRole === 'button');
    expect(flat(button as Instance).minHeight).toBeGreaterThanOrEqual(44);
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });
});

describe('NextGameCard', () => {
  it('shows "Next game", the title and venue, and opens on press', () => {
    const onPress = jest.fn();
    const root = render(
      <NextGameCard
        event={makeEvent({ title: 'Sunday smash', venue_name: 'Court 3', starts_at: '2030-01-06T09:00:00Z' })}
        onPress={onPress}
      />,
    );
    expect(texts(root).some(text => text.startsWith('Next game'))).toBe(true);
    expect(texts(root)).toContain('Sunday smash');
    expect(texts(root).some(text => text.includes('Court 3'))).toBe(true);
    act(() => root.find(node => node.props.accessibilityRole === 'button').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('GroupRow (AD-8)', () => {
  const group: Group = {
    id: 'g1',
    name: 'Tuesday crew',
    description: '',
    owner_id: 'o',
    created_at: '2026-01-01T00:00:00Z',
    current_user_role: 'member',
    member_count: 8,
  };

  it('a Players Group shows the groups icon and its member count, no sport', () => {
    const root = render(<GroupRow group={group} onPress={jest.fn()} />);
    expect(root.findAllByType(GroupsIcon)).toHaveLength(1);
    expect(root.findAllByType(SportIcon)).toHaveLength(0);
    expect(texts(root)).toContain('8 members');
  });

  it('a Team shows its sport icon, plus the sport in the meta', () => {
    const root = render(
      <GroupRow
        group={group}
        team={{ sportSlug: 'tennis', sportName: 'Tennis' }}
        onPress={jest.fn()}
      />,
    );
    expect(root.findAllByType(GroupsIcon)).toHaveLength(0);
    expect(root.findAllByType(SportIcon)[0].props.slug).toBe('tennis');
    expect(texts(root)).toContain('8 members · Tennis');
  });

  it('omits the member count when the list item does not carry one', () => {
    const root = render(<GroupRow group={{ ...group, member_count: undefined }} onPress={jest.fn()} />);
    expect(texts(root)).toEqual(['Tuesday crew']);
  });
});

describe('ShortcutTiles', () => {
  it('shows "{n} active" and "{n} groups" and has exactly two tiles (no Tournaments tile)', () => {
    const root = render(
      <ShortcutTiles gamesCount={4} groupsCount={2} onPressGames={jest.fn()} onPressGroups={jest.fn()} />,
    );
    const all = texts(root);
    expect(all).toEqual(['My games', '4 active', 'My groups', '2 groups']);
    expect(all.join(' ')).not.toMatch(/tournament/i);
  });

  it('uses the singular for one group and drops a count whose source failed', () => {
    const one = render(
      <ShortcutTiles gamesCount={1} groupsCount={1} onPressGames={jest.fn()} onPressGroups={jest.fn()} />,
    );
    expect(texts(one)).toContain('1 group');
    const failed = render(
      <ShortcutTiles
        gamesCount={null}
        groupsCount={null}
        onPressGames={jest.fn()}
        onPressGroups={jest.fn()}
      />,
    );
    expect(texts(failed)).toEqual(['My games', 'My groups']);
  });

  it('fires the matching handler', () => {
    const onPressGames = jest.fn();
    const onPressGroups = jest.fn();
    const root = render(
      <ShortcutTiles
        gamesCount={4}
        groupsCount={2}
        onPressGames={onPressGames}
        onPressGroups={onPressGroups}
      />,
    );
    act(() => pressableLabelled(root, 'My games, 4 active').props.onPress());
    act(() => pressableLabelled(root, 'My groups, 2 groups').props.onPress());
    expect(onPressGames).toHaveBeenCalledTimes(1);
    expect(onPressGroups).toHaveBeenCalledTimes(1);
  });
});

describe('section parts', () => {
  it('SectionHeader shows a header-role title and a View all button only when given a handler', () => {
    const onViewAll = jest.fn();
    const withLink = render(<SectionHeader title="My games" onViewAll={onViewAll} />);
    expect(withLink.findAll(node => node.props.accessibilityRole === 'header')).not.toHaveLength(0);
    act(() => pressableLabelled(withLink, 'View all My games').props.onPress());
    expect(onViewAll).toHaveBeenCalledTimes(1);
    expect(texts(render(<SectionHeader title="X" />))).toEqual(['X']);
  });

  it('InlineError shows its message and a working Retry', () => {
    const onRetry = jest.fn();
    const root = render(<InlineError message="Couldn't load your games" onRetry={onRetry} />);
    expect(texts(root)).toContain("Couldn't load your games");
    act(() => pressableLabelled(root, 'Retry').props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('SkeletonRows renders the requested number of rows; EmptyText renders its copy', () => {
    const root = render(<SkeletonRows count={3} testID="sk" />);
    expect(hostByTestId(root, 'sk').children).toHaveLength(3);
    expect(texts(render(<EmptyText>Nothing here</EmptyText>))).toEqual(['Nothing here']);
  });
});
