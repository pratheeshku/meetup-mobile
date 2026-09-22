/**
 * Raised center "+" action button for the bottom tab bar. Tapping it opens
 * the Create menu (`CreateMenu`: Game / Group — see the Create Flow
 * Amendment, DES-MEETUP-MOBILE.md §4.3); choosing an entry navigates to
 * that screen inside its own tab's stack.
 *
 * It is an action, not a destination: the `Create` tab exists only so the
 * button has a slot in the middle of the bar. The button never calls the tab
 * bar's `onPress`, so the tab is never selected/focused and the button has no
 * active styling or `selected` accessibility state.
 *
 * The tab bar invokes `tabBarButton` as a plain function (not as a
 * component), so hooks must not live in `CreateTabButton` itself — it only
 * returns an element, and the stateful `CreateFab` is a real component with
 * its own hook order.
 *
 * Sizing comes from tokens only. There is no FAB-size token, so the 56dp
 * diameter is composed from spacing tokens (`xxl` + `sm`); a dedicated
 * `sizes.fab` token would be the cleaner home for it.
 */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabBarButtonProps, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { colors, opacity, radius, shadows, spacing, typography } from '../theme/tokens';
import CreateMenu from './CreateMenu';
import type { CreateTarget } from './CreateMenu';
import type { AppTabParamList } from './types';

const FAB_SIZE = spacing.xxl + spacing.sm;
/** How far the button sits above the tab bar's top edge (upward overhang). */
const FAB_RAISE = spacing.lg;

/**
 * `tabBarButton` for the `Create` tab. Only `style` (carries the tab item's
 * flex so the five slots stay equal width) and `testID` are used from the
 * tab bar's props.
 */
export function CreateTabButton(props: BottomTabBarButtonProps): React.JSX.Element {
  return <CreateFab style={props.style} testID={props.testID} />;
}

/**
 * Opens the create screen for `target`. `initial: false` keeps the tab's list
 * screen underneath when the tab's stack has not been mounted yet (tabs are
 * lazy), so Back returns to the list instead of leaving the stack empty.
 */
export function navigateToCreate(
  navigation: BottomTabNavigationProp<AppTabParamList>,
  target: CreateTarget,
): void {
  switch (target) {
    case 'game':
      navigation.navigate('Home', { screen: 'CreateGame', initial: false });
      break;
    case 'group':
      navigation.navigate('Groups', { screen: 'CreateGroup', initial: false });
      break;
  }
}

function CreateFab({
  style,
  testID,
}: {
  style: BottomTabBarButtonProps['style'];
  testID: BottomTabBarButtonProps['testID'];
}): React.JSX.Element {
  // The tab bar sits outside every screen's navigation context, so this
  // resolves to the container-level navigation object, whose `navigate` can
  // target any tab (verified end-to-end in CreateTabButton.test.tsx).
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const selectTarget = useCallback(
    (target: CreateTarget) => {
      setMenuOpen(false);
      navigateToCreate(navigation, target);
    },
    [navigation],
  );

  return (
    <View style={[style, styles.slot]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        accessibilityHint="Opens a menu to create a game or group"
        testID={testID}
        onPress={() => setMenuOpen(true)}
        style={({ pressed }) => [styles.fab, pressed ? styles.pressed : null]}
      >
        <Text style={styles.plus} accessibilityElementsHidden importantForAccessibility="no">
          +
        </Text>
      </Pressable>
      <CreateMenu visible={menuOpen} onSelect={selectTarget} onClose={closeMenu} />
    </View>
  );
}

/** Required by the tab navigator; never rendered because the button never selects the tab. */
export function CreateTabScreen(): null {
  return null;
}

// Android takes `elevation`, iOS takes the shadow* props — split from the one token.
const { elevation, ...iosShadow } = shadows.overlay;
const fabShadow = Platform.select<ViewStyle>({ android: { elevation }, default: iosShadow });

const styles = StyleSheet.create({
  // `style` from the tab bar supplies flex/alignItems/padding; the negative
  // margin on the button (not the slot) raises only the circle.
  slot: { alignItems: 'center' },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.full,
    marginTop: -FAB_RAISE,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...fabShadow,
  },
  pressed: { opacity: opacity.pressed },
  plus: { ...typography.h1, color: colors.white },
});
