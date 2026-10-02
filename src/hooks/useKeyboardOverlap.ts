/**
 * How far the on-screen keyboard covers the bottom of a container (Android).
 *
 * Why this exists instead of relying on `android:windowSoftInputMode=
 * "adjustResize"` or `KeyboardAvoidingView`: the app targets SDK 36, so on
 * Android 15+ the window is forced edge-to-edge (the `edgeToEdgeEnabled=false`
 * Gradle flag only stops React Native opting in; it cannot opt out of the OS
 * enforcement) and `adjustResize` no longer shrinks the content. On older
 * Android it still does. Measuring the real overlap handles both: when the OS
 * already resized the window the container ends above the keyboard and the
 * overlap is 0; when it did not, the overlap is the covered height.
 *
 * The container is re-measured whenever its own size changes (`remeasure`,
 * wired to its `onLayout`), because on a resizing Android the keyboard event
 * can arrive before the window has been resized.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';

export function useKeyboardOverlap(
  containerRef: RefObject<View | null>,
  enabled: boolean,
): { overlap: number; remeasure: () => void } {
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);

  const remeasure = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null || !containerRef.current) {
      setOverlap(0);
      return;
    }
    containerRef.current.measureInWindow((_x, y, _width, height) => {
      // Re-read: the keyboard may have gone away while measuring.
      const current = keyboardTop.current;
      setOverlap(current === null ? 0 : Math.max(0, Math.round(y + height - current)));
    });
  }, [containerRef]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      remeasure();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
      keyboardTop.current = null;
    };
  }, [enabled, remeasure]);

  return { overlap: enabled ? overlap : 0, remeasure };
}
