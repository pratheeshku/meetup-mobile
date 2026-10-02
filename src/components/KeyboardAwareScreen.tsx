/**
 * The one screen wrapper for every screen that has a text input: the focused
 * field is always visible above the on-screen keyboard, on iOS and Android.
 * Built on React Native APIs only.
 *
 * - iOS: `KeyboardAvoidingView` with `behavior="padding"` (it follows the
 *   keyboard's frame changes and animation).
 * - Android: no `KeyboardAvoidingView`. The bottom of the container is padded
 *   by the measured keyboard overlap (`useKeyboardOverlap`), which is correct
 *   whether or not the OS resizes the window (edge-to-edge is forced at
 *   targetSdk 36, which makes `adjustResize` unreliable).
 * - A `ScrollView` with `keyboardShouldPersistTaps="handled"` and
 *   drag-to-dismiss. The keyboard's height is applied as padding on the
 *   container, which shrinks the scroll viewport by the same amount — so the
 *   last field can always be scrolled above the keyboard; a little extra
 *   content padding is added while the keyboard is open.
 * - When a `TextField` gains focus it scrolls itself into view (see
 *   `useKeyboardAwareScroll`); it does so again when the viewport resizes
 *   (the keyboard finished appearing) and while a multiline field grows.
 *
 * Jest cannot prove any of this on a real keyboard: see the manual device
 * checklist that came with this component.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  TextInput,
  ViewStyle,
} from 'react-native';

import { useKeyboardOverlap } from '../hooks/useKeyboardOverlap';
import { spacing } from '../theme/tokens';

/** Space kept between a focused field and the edge of the visible area. */
export const FOCUS_MARGIN = spacing.md;

/**
 * How far to scroll (positive = down) so a field whose top/bottom edges sit at
 * `fieldTop`/`fieldBottom` (relative to the top of the scroll viewport) is
 * inside the viewport with `margin` to spare. The bottom edge wins when the
 * field is taller than the viewport (the caret is at the end of what is typed).
 */
export function computeScrollDelta({
  fieldTop,
  fieldBottom,
  viewportHeight,
  margin = FOCUS_MARGIN,
}: {
  fieldTop: number;
  fieldBottom: number;
  viewportHeight: number;
  margin?: number;
}): number {
  if (fieldBottom + margin > viewportHeight) {
    return fieldBottom + margin - viewportHeight;
  }
  if (fieldTop < margin) {
    return fieldTop - margin;
  }
  return 0;
}

interface KeyboardAwareScroll {
  /** Scroll `input` into view; remembered while focused, so it is redone as the viewport/field resizes. */
  scrollIntoView: (input: TextInput | null) => void;
  /** Stop following `input` (it lost focus). */
  clearFocus: (input: TextInput | null) => void;
}

const KeyboardAwareScrollContext = createContext<KeyboardAwareScroll | null>(null);

/** `null` outside a `KeyboardAwareScreen`, so `TextField` also works standalone. */
export function useKeyboardAwareScroll(): KeyboardAwareScroll | null {
  return useContext(KeyboardAwareScrollContext);
}

interface Props {
  children: React.ReactNode;
  /** Same as `ScrollView`'s: padding and layout of the scrolled content. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function KeyboardAwareScreen({
  children,
  contentContainerStyle,
  testID,
}: Props): React.JSX.Element {
  const isIos = Platform.OS === 'ios';
  const containerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const focused = useRef<TextInput | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { overlap, remeasure } = useKeyboardOverlap(containerRef, !isIos);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const ensureVisible = useCallback((input: TextInput) => {
    const container = containerRef.current;
    if (!container || viewportHeight.current <= 0) {
      return;
    }
    input.measureLayout(
      container,
      (_x, y, _width, height) => {
        const delta = computeScrollDelta({
          fieldTop: y,
          fieldBottom: y + height,
          viewportHeight: viewportHeight.current,
        });
        if (delta !== 0) {
          scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: true });
        }
      },
      () => {},
    );
  }, []);

  const api = useMemo<KeyboardAwareScroll>(
    () => ({
      scrollIntoView: input => {
        if (!input) {
          return;
        }
        focused.current = input;
        ensureVisible(input);
      },
      clearFocus: input => {
        if (focused.current === input) {
          focused.current = null;
        }
      },
    }),
    [ensureVisible],
  );

  const handleScrollViewLayout = (event: LayoutChangeEvent): void => {
    viewportHeight.current = event.nativeEvent.layout.height;
    // The keyboard finished (dis)appearing: the focused field may now be covered.
    if (focused.current) {
      ensureVisible(focused.current);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  };

  const body = (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onLayout={handleScrollViewLayout}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[contentContainerStyle, keyboardVisible ? styles.keyboardRoom : null]}
    >
      {children}
    </ScrollView>
  );

  // The padded/measured container is a plain View on both platforms (the
  // layout of a field is measured relative to it); on iOS it sits inside the
  // KeyboardAvoidingView, which shrinks it when the keyboard appears.
  const container = (
    <View
      ref={containerRef}
      style={[styles.fill, isIos ? null : { paddingBottom: overlap }]}
      onLayout={isIos ? undefined : remeasure}
      testID={testID}
    >
      {body}
    </View>
  );

  return (
    <KeyboardAwareScrollContext.Provider value={api}>
      {isIos ? (
        <KeyboardAvoidingView style={styles.fill} behavior="padding">
          {container}
        </KeyboardAvoidingView>
      ) : (
        container
      )}
    </KeyboardAwareScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  keyboardRoom: { paddingBottom: spacing.xxl },
});
