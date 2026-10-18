/**
 * Test-only: a `navigation` double whose focus and the app's foreground can be driven.
 * `fireFocus()` is a screen coming back into focus; `foreground()` is the app returning
 * from the background (only reaches screens that are `focused`). Not imported by production code.
 */
import { AppState } from 'react-native';

type Handler = (state: string) => void;

export interface FocusNavigationDouble {
  navigation: {
    navigate: jest.Mock;
    goBack: jest.Mock;
    canGoBack: jest.Mock;
    setOptions: jest.Mock;
    getParent: () => { navigate: jest.Mock };
    addListener: jest.Mock;
    isFocused: jest.Mock;
  };
  /** The screen regains focus (React Navigation's 'focus' event). */
  fireFocus: () => void;
  /** The app goes to the background, then returns to the foreground. */
  foreground: () => void;
  setFocused: (focused: boolean) => void;
}

export function createFocusNavigation(): FocusNavigationDouble {
  const focusListeners = new Set<() => void>();
  const appHandlers = new Set<Handler>();
  let focused = true;

  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: Handler) => {
    appHandlers.add(handler);
    return { remove: () => appHandlers.delete(handler) };
  }) as never);

  const navigate = jest.fn();
  return {
    navigation: {
      navigate,
      goBack: jest.fn(),
      canGoBack: jest.fn(() => true),
      setOptions: jest.fn(),
      getParent: () => ({ navigate }),
      addListener: jest.fn((_event: string, callback: () => void) => {
        focusListeners.add(callback);
        return () => focusListeners.delete(callback);
      }),
      isFocused: jest.fn(() => focused),
    },
    fireFocus: () => focusListeners.forEach(callback => callback()),
    foreground: () => {
      appHandlers.forEach(handler => handler('background'));
      appHandlers.forEach(handler => handler('active'));
    },
    setFocused: value => {
      focused = value;
    },
  };
}
