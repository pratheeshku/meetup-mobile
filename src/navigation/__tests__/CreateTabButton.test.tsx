/**
 * Create center action button: an action, not a destination. Tapping it opens
 * a three-option menu (Game / Group / Tournament); it must never select the
 * `Create` tab, and dismissing the menu must never navigate.
 *
 * The end-to-end block mounts real navigators (tab bar + nested stacks) so
 * the framework-internal parts — `useNavigation()` resolving from inside the
 * tab bar, and `tabBarButton` being invoked as a plain function — are
 * verified empirically rather than assumed.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ReactTestRenderer from 'react-test-renderer';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { colors, radius, spacing } from '../../theme/tokens';
import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import { CreateTabButton, CreateTabScreen, navigateToCreate } from '../CreateTabButton';

const FAB_SIZE = spacing.xxl + spacing.sm;

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    // Overridden per-test in the end-to-end block via `mockUseRealNavigation`.
    useNavigation: (...args: unknown[]) =>
      mockUseRealNavigation ? actual.useNavigation(...args) : { navigate: mockNavigate },
  };
});
let mockUseRealNavigation = false;

function renderButton() {
  const props = { onPress: jest.fn(), style: { flex: 1 }, children: null } as unknown as BottomTabBarButtonProps;
  return { root: render(<CreateTabButton {...props} />), onPress: props.onPress };
}

beforeEach(() => {
  mockNavigate.mockReset();
  mockUseRealNavigation = false;
});

describe('CreateTabButton', () => {
  it('is a labelled button showing a white "+"', () => {
    const { root } = renderButton();
    expect(pressableLabelled(root, 'Create')).toBeDefined();
    expect(texts(root)).toContain('+');
    const plus = root.find(node => (node.type as unknown) === 'Text' && node.props.children === '+');
    expect(StyleSheet.flatten(plus.props.style).color).toBe(colors.white);
  });

  it('is a 56dp primary circle raised above the bar', () => {
    const pressable = pressableLabelled(renderButton().root, 'Create');
    const style = StyleSheet.flatten(
      (pressable.props.style as (s: { pressed: boolean }) => unknown)({ pressed: false }),
    ) as Record<string, unknown>;
    expect(style).toMatchObject({
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    });
    expect(FAB_SIZE).toBe(56);
    expect(style.marginTop as number).toBeLessThan(0);
  });

  it('has no selected/active state (it is not a tab destination)', () => {
    const pressable = pressableLabelled(renderButton().root, 'Create');
    expect(pressable.props.accessibilityState?.selected).toBeUndefined();
    expect(pressable.props['aria-selected']).toBeUndefined();
  });

  it('opens the three-option menu on tap without touching the tab bar or navigating', () => {
    const { root, onPress } = renderButton();
    expect(() => pressableLabelled(root, 'Create Group')).toThrow(/found 0/);
    act(() => pressableLabelled(root, 'Create').props.onPress());
    expect(texts(root)).toEqual(expect.arrayContaining(['Create Game', 'Create Group', 'Create Tournament']));
    expect(onPress).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([
    ['Create Game', 'Home', { screen: 'CreateGame', initial: false }],
    ['Create Group', 'Groups', { screen: 'CreateGroup', initial: false }],
    ['Create Tournament', 'Tournaments', { screen: 'CreateTournament', initial: false }],
  ])('"%s" closes the menu and navigates to %s', (label, tab, params) => {
    const { root } = renderButton();
    act(() => pressableLabelled(root, 'Create').props.onPress());
    act(() => pressableLabelled(root, label).props.onPress());
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(tab, params);
    expect(() => pressableLabelled(root, label)).toThrow(/found 0/);
  });

  it('Close button and backdrop dismiss the menu without navigating', () => {
    const { root } = renderButton();
    act(() => pressableLabelled(root, 'Create').props.onPress());
    act(() => pressableLabelled(root, 'Close').props.onPress()); // Button labels itself "Close"
    expect(() => pressableLabelled(root, 'Create Game')).toThrow(/found 0/);

    act(() => pressableLabelled(root, 'Create').props.onPress());
    act(() => pressableLabelled(root, 'Close create menu').props.onPress());
    expect(() => pressableLabelled(root, 'Create Game')).toThrow(/found 0/);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('navigateToCreate', () => {
  it('maps each target to its tab + create screen, keeping the list underneath', () => {
    const navigation = { navigate: jest.fn() };
    navigateToCreate(navigation as never, 'group');
    expect(navigation.navigate).toHaveBeenCalledWith('Groups', { screen: 'CreateGroup', initial: false });
  });
});

describe('CreateTabScreen', () => {
  it('renders nothing', () => {
    expect(CreateTabScreen()).toBeNull();
  });
});

describe('end-to-end with real navigators', () => {
  const Stub = (name: string) => () => <Text>{name}</Text>;
  const Tabs = createBottomTabNavigator();
  const HomeStack = createNativeStackNavigator();
  const GroupsStack = createNativeStackNavigator();
  const TournamentsStack = createNativeStackNavigator();

  const Home = () => (
    <HomeStack.Navigator>
      <HomeStack.Screen name="EventsList" component={Stub('events')} />
      <HomeStack.Screen name="CreateGame" component={Stub('create-game')} />
    </HomeStack.Navigator>
  );
  const Groups = () => (
    <GroupsStack.Navigator>
      <GroupsStack.Screen name="GroupsList" component={Stub('groups')} />
      <GroupsStack.Screen name="CreateGroup" component={Stub('create-group')} />
    </GroupsStack.Navigator>
  );
  const Tournaments = () => (
    <TournamentsStack.Navigator>
      <TournamentsStack.Screen name="TournamentsList" component={Stub('tournaments')} />
      <TournamentsStack.Screen name="CreateTournament" component={Stub('create-tournament')} />
    </TournamentsStack.Navigator>
  );

  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  // Unmount and let the navigators' deferred work settle inside the test, so
  // nothing fires after the Jest environment is torn down.
  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = undefined;
  });

  async function mount() {
    mockUseRealNavigation = true;
    const ref = createNavigationContainerRef<ParamListBase>();
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <NavigationContainer ref={ref}>
          <Tabs.Navigator screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="Home" component={Home} />
            <Tabs.Screen name="Groups" component={Groups} />
            <Tabs.Screen name="Create" component={CreateTabScreen} options={{ tabBarButton: CreateTabButton }} />
            <Tabs.Screen name="Tournaments" component={Tournaments} />
          </Tabs.Navigator>
        </NavigationContainer>,
      );
    });
    return { ref, root: renderer!.root };
  }

  /** Focused tab and the routes in its nested stack, from the live state. */
  function snapshot(ref: ReturnType<typeof createNavigationContainerRef<ParamListBase>>) {
    const state = ref.getRootState();
    if (!state) {
      throw new Error('navigation container is not ready');
    }
    const tab = state.routes[state.index];
    return { tab: tab.name, stack: tab.state?.routes.map(r => r.name) };
  }

  it.each([
    ['Create Game', 'Home', ['EventsList', 'CreateGame']],
    ['Create Group', 'Groups', ['GroupsList', 'CreateGroup']],
    ['Create Tournament', 'Tournaments', ['TournamentsList', 'CreateTournament']],
  ])('"%s" opens %s > create screen with the list underneath, never focusing Create', async (label, tab, stack) => {
    const { ref, root } = await mount();
    await act(async () => pressableLabelled(root, 'Create').props.onPress());
    await act(async () => pressableLabelled(root, label).props.onPress());
    expect(snapshot(ref)).toEqual({ tab, stack });
    expect(ref.getCurrentRoute()?.name).not.toBe('Create');
  });
});
