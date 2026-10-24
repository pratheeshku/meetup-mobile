/**
 * Focus without opening anything (te-a4, AD-T13): when `token` changes to a non-zero value the control gets a visible
 * focus ring and the screen reader's focus, and nothing is pressed (a date or choice field must not open its picker).
 * The ring clears when the token goes back to 0, when the control is pressed or when it loses focus. A text field does
 * not use this: it is focused with `ref.focus()` so the keyboard opens.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, type TextInput, type View } from 'react-native';

import { borderWidth, colors } from '../theme/tokens';

/** The visible focus ring (theme tokens only). */
export const focusRingStyle = { borderColor: colors.primary, borderWidth: borderWidth.thick } as const;

export function useAccessibilityFocus(token: number | undefined): {
  ref: React.RefObject<View | null>;
  ringed: boolean;
  clear: () => void;
} {
  const ref = useRef<View | null>(null);
  const [ringed, setRinged] = useState(false);
  useEffect(() => {
    if (!token) {
      setRinged(false);
      return;
    }
    setRinged(true);
    try {
      const handle = findNodeHandle(ref.current);
      if (handle) {
        AccessibilityInfo.setAccessibilityFocus(handle);
      }
    } catch {
      // The element is not mounted any more; the ring still shows.
    }
  }, [token]);
  const clear = useCallback(() => setRinged(false), []);
  return { ref, ringed, clear };
}

/** Focus of a text field on a wizard step change (te-a4): a new non-zero `token` calls `focus()` so the keyboard opens. */
export function useTextFocus(token: number | undefined): React.RefObject<TextInput | null> {
  const ref = useRef<TextInput | null>(null);
  useEffect(() => {
    if (token) {
      ref.current?.focus();
    }
  }, [token]);
  return ref;
}
