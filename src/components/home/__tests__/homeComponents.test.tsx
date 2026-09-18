/**
 * Behavioural contract of the Home dashboard's presentational components.
 * Focus: the rules the brief states (max three cards, exact empty-state
 * copy, "All" selected by default) and
 * the accessibility semantics that keep an inert tile from looking tappable.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import StatCard from '../../StatCard';
import { colors } from '../../../theme/tokens';
import { makeEvent } from '../../../test-utils/makeEvent';
import {
  act,
  pressableLabelled,
  pressables,
  pressableWithText,
  render,
  texts,
} from '../../../test-utils/render';
import { getSportOptions } from '../../../utils/homeDashboard';
import GreetingHeader from '../GreetingHeader';
import MyGamesGroupsSection from '../MyGamesGroupsSection';
import RecommendedSection from '../RecommendedSection';
import SportFilterPills from '../SportFilterPills';
import UpcomingGamesSection from '../UpcomingGamesSection';

const fiveEvents = Array.from({ length: 5 }, (_, i) =>
  makeEvent({ id: `e${i}`, title: `Game ${i}` }),
);

describe('GreetingHeader', () => {
  it('shows the muted greeting and the personalised headline', () => {
    const t = texts(render(<GreetingHeader nickname="Sam" />));
    expect(t).toContain('Good to see you 👋');
    expect(t).toContain('Ready to play, Sam?');
  });

  it('drops the name (no "undefined" / stray comma) when the nickname is missing or blank', () => {
    expect(texts(render(<GreetingHeader />))).toContain('Ready to play?');
    expect(texts(render(<GreetingHeader nickname="   " />))).toContain('Ready to play?');
  });

  it('renders no Create Game control (it lives in the tab bar now)', () => {
    const root = render(<GreetingHeader nickname="Sam" />);
    expect(texts(root).some(text => text.includes('Create Game'))).toBe(false);
    expect(pressables(root)).toHaveLength(0);
  });
});

describe('SportFilterPills', () => {
  const sports = getSportOptions([
    makeEvent({ sport: 'badminton' }),
    makeEvent({ sport: 'curling' }),
  ]);

  it('renders "All" first, then one pill per sport with its emoji (🎯 for an unmapped sport)', () => {
    const t = texts(render(<SportFilterPills sports={sports} selectedKey={null} onSelect={jest.fn()} />));
    expect(t).toEqual(['All', '🏸 Badminton', '🎯 Curling']);
  });

  it('marks only "All" selected when selectedKey is null', () => {
    const root = render(<SportFilterPills sports={sports} selectedKey={null} onSelect={jest.fn()} />);
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
    expect(pressableLabelled(root, 'Badminton').props.accessibilityState).toEqual({ selected: false });
  });

  it('marks only the chosen sport selected, and gives it the primary fill', () => {
    const root = render(
      <SportFilterPills sports={sports} selectedKey="badminton" onSelect={jest.fn()} />,
    );
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: false });
    const selected = pressableLabelled(root, 'Badminton');
    expect(selected.props.accessibilityState).toEqual({ selected: true });
    const style = StyleSheet.flatten(selected.props.style({ pressed: false }));
    expect(style.backgroundColor).toBe(colors.primary);
  });

  it('reports the sport key on press, and null for "All"', () => {
    const onSelect = jest.fn();
    const root = render(<SportFilterPills sports={sports} selectedKey="badminton" onSelect={onSelect} />);
    act(() => pressableLabelled(root, 'Curling').props.onPress());
    expect(onSelect).toHaveBeenLastCalledWith('curling');
    act(() => pressableLabelled(root, 'All sports').props.onPress());
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('with no sports still shows just "All"', () => {
    const t = texts(render(<SportFilterPills sports={[]} selectedKey={null} onSelect={jest.fn()} />));
    expect(t).toEqual(['All']);
  });
});

describe.each([
  {
    name: 'UpcomingGamesSection',
    Section: UpcomingGamesSection,
    title: 'Your Upcoming Games',
    subtitle: "Games you've already registered for",
    empty: 'No upcoming games yet — join one below or create your own.',
  },
  {
    name: 'RecommendedSection',
    Section: RecommendedSection,
    title: 'Recommended for You',
    subtitle: "Public games you haven't joined yet",
    empty: 'No public games to recommend right now.',
  },
])('$name', ({ Section, title, subtitle, empty }) => {
  it('shows the exact title and subtitle copy', () => {
    const t = texts(render(<Section events={[fiveEvents[0]]} onEventPress={jest.fn()} />));
    expect(t).toContain(title);
    expect(t).toContain(subtitle);
  });

  it('shows the exact empty-state copy, and no "View all", when there are no events', () => {
    const t = texts(render(<Section events={[]} onEventPress={jest.fn()} />));
    expect(t).toContain(empty);
    expect(t).not.toContain('View all →');
  });

  it('shows at most three cards, in the order supplied', () => {
    const t = texts(render(<Section events={fiveEvents} onEventPress={jest.fn()} />));
    expect(t.filter(text => /^Game \d$/.test(text))).toEqual(['Game 0', 'Game 1', 'Game 2']);
    expect(t).not.toContain(empty);
  });

  it('offers no "View all" when three or fewer events exist (nothing more to reveal)', () => {
    const t = texts(render(<Section events={fiveEvents.slice(0, 3)} onEventPress={jest.fn()} />));
    expect(t).not.toContain('View all →');
    expect(t).not.toContain('Show less');
  });

  it('"View all →" reveals every event and becomes "Show less", which collapses again', () => {
    const root = render(<Section events={fiveEvents} onEventPress={jest.fn()} />);
    const games = (): string[] => texts(root).filter(text => /^Game \d$/.test(text));

    act(() => pressableWithText(root, 'View all →').props.onPress());
    expect(games()).toEqual(['Game 0', 'Game 1', 'Game 2', 'Game 3', 'Game 4']);
    expect(texts(root)).not.toContain('View all →');

    act(() => pressableWithText(root, 'Show less').props.onPress());
    expect(games()).toEqual(['Game 0', 'Game 1', 'Game 2']);
    expect(texts(root)).toContain('View all →');
  });

  it('reports the pressed event', () => {
    const onEventPress = jest.fn();
    const root = render(<Section events={fiveEvents} onEventPress={onEventPress} />);
    act(() => pressableWithText(root, 'Game 1').props.onPress());
    expect(onEventPress).toHaveBeenCalledWith(fiveEvents[1]);
  });
});

describe('MyGamesGroupsSection', () => {
  it('shows both tiles with the specified copy', () => {
    const t = texts(
      render(<MyGamesGroupsSection myGamesCount={4} groupsCount={2} onPressMyGroups={jest.fn()} />),
    );
    expect(t).toEqual(
      expect.arrayContaining([
        'My Games & Groups',
        '🎮',
        'My Games',
        '4 active · tap to manage',
        '👥',
        'My Groups',
        '2 groups · tap to manage',
      ]),
    );
  });

  it('uses the singular for exactly one group', () => {
    const t = texts(
      render(<MyGamesGroupsSection myGamesCount={0} groupsCount={1} onPressMyGroups={jest.fn()} />),
    );
    expect(t).toContain('1 group · tap to manage');
  });

  it('shows zero counts honestly', () => {
    const t = texts(
      render(<MyGamesGroupsSection myGamesCount={0} groupsCount={0} onPressMyGroups={jest.fn()} />),
    );
    expect(t).toContain('0 active · tap to manage');
    expect(t).toContain('0 groups · tap to manage');
  });

  it('omits the count (rather than showing a wrong 0) when the groups request failed', () => {
    const t = texts(
      render(
        <MyGamesGroupsSection myGamesCount={1} groupsCount={null} onPressMyGroups={jest.fn()} />,
      ),
    );
    expect(t).toContain('Tap to manage');
    expect(t.join(' ')).not.toMatch(/\d+ groups?/);
  });

  it('makes only My Groups pressable; My Games is inert', () => {
    const onPressMyGroups = jest.fn();
    const root = render(
      <MyGamesGroupsSection myGamesCount={4} groupsCount={2} onPressMyGroups={onPressMyGroups} />,
    );
    const pressable = pressables(root);
    expect(pressable).toHaveLength(1);
    expect(pressable[0].props.accessibilityLabel).toBe('My Groups, 2 groups · tap to manage');
    act(() => pressable[0].props.onPress());
    expect(onPressMyGroups).toHaveBeenCalledTimes(1);
  });
});

describe('StatCard', () => {
  it('renders icon, title and subtitle', () => {
    const t = texts(render(<StatCard icon="🎮" title="My Games" subtitle="3 active" />));
    expect(t).toEqual(['🎮', 'My Games', '3 active']);
  });

  it('is not a button when it has no action', () => {
    expect(pressables(render(<StatCard icon="🎮" title="T" subtitle="S" />))).toHaveLength(0);
  });

  it('is a labelled button that fires onPress when it has an action', () => {
    const onPress = jest.fn();
    const [pressable] = pressables(
      render(<StatCard icon="👥" title="My Groups" subtitle="2 groups" onPress={onPress} />),
    );
    expect(pressable.props.accessibilityLabel).toBe('My Groups, 2 groups');
    pressable.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
