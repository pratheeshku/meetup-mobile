/**
 * Access-consistency AC-10 / AD-8: a screen fetches on EVERY focus (including
 * the first) and when the app returns to the foreground while the screen is
 * the focused one. Replaces mount-only loads and the 30 s Home throttle.
 *
 * Takes the screen's `navigation` prop (not `useFocusEffect`) so it works for
 * screens rendered with a plain navigation object, like `HomeScreen` always did.
 * `load` is read through a ref, so a new function identity never re-triggers.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

interface FocusNavigation {
  addListener?: (event: 'focus', callback: () => void) => () => void;
  isFocused?: () => boolean;
}

export function useRefetchOnFocus(
  navigation: FocusNavigation | undefined,
  load: () => void,
  /** When this changes (for example the id the screen shows), the screen fetches again. */
  key?: string | number,
): void {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const isFocused = (): boolean => navigation?.isFocused?.() ?? true;

    // First focus: the 'focus' event has already fired by the time effects run.
    if (isFocused()) {
      loadRef.current();
    }
    const unsubscribeFocus = navigation?.addListener?.('focus', () => loadRef.current());

    let previousState = AppState.currentState;
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      const wasInBackground = typeof previousState === 'string' && /inactive|background/.test(previousState);
      if (wasInBackground && nextState === 'active' && isFocused()) {
        loadRef.current();
      }
      previousState = nextState;
    });

    return () => {
      unsubscribeFocus?.();
      appStateSubscription.remove();
    };
  }, [navigation, key]);
}
