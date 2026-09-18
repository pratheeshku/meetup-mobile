/**
 * Raised center "+" action button for the bottom tab bar (Create Game).
 *
 * It is an action, not a destination: the `Create` tab exists only so the
 * button has a slot in the middle of the bar. Pressing it is intercepted
 * (`createTabListeners`) and routed to Home -> CreateGame, so the `Create`
 * route is never focused and the button has no active/selected styling or
 * `selected` accessibility state.
 *
 * Module-level component and listener factory (not inline arrows in the
 * navigator's options) so React sees stable identities across renders.
 *
 * Sizing comes from tokens only. There is no FAB-size token, so the 56dp
 * diameter is composed from spacing tokens (`xxl` + `sm`); a dedicated
 * `sizes.fab` token would be the cleaner home for it.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { colors, opacity, radius, shadows, spacing, typography } from '../theme/tokens';
import type { AppTabParamList } from './types';

const FAB_SIZE = spacing.xxl + spacing.sm;
/** How far the button sits above the tab bar's top edge (upward overhang). */
const FAB_RAISE = spacing.lg;

/**
 * `tabBarButton` for the `Create` tab. Only `onPress` (which emits
 * `tabPress`, where `createTabListeners` intercepts it), `style` (carries the
 * tab item's flex so the five slots stay equal width) and `testID` are used
 * from the tab bar's props.
 */
export function CreateTabButton({
  onPress,
  style,
  testID,
}: BottomTabBarButtonProps): React.JSX.Element {
  return (
    <View style={[style, styles.slot]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create Game"
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed ? styles.pressed : null]}
      >
        <Text style={styles.plus} accessibilityElementsHidden importantForAccessibility="no">
          +
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * `listeners` for the `Create` tab: cancels the default tab switch and opens
 * the Create Game screen inside the Home stack instead.
 */
export function createTabListeners({
  navigation,
}: {
  navigation: BottomTabNavigationProp<AppTabParamList, 'Create'>;
}): { tabPress: (event: { preventDefault: () => void }) => void } {
  return {
    tabPress: event => {
      event.preventDefault();
      navigation.navigate('Home', { screen: 'CreateGame' });
    },
  };
}

/** Required by the tab navigator; never rendered because the press is intercepted. */
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
