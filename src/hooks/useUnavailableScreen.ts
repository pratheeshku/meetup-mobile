/**
 * What a game / group / tournament detail screen does when the server answers 404 (AC-10, AD-8).
 *
 * - `onNotFound()`: the target is gone or no longer visible, whether the 404 came from the detail
 *   fetch or from an action on the open screen (join, leave, RSVP, withdraw, member changes).
 *   Closes the screen and shows the neutral "no longer available" message, once.
 * - `markOwnAction()`: call right after the user's OWN successful action that can take the target
 *   away from them (cancel / delete / leave / withdraw). A 404 after that closes the screen
 *   quietly: the existing completion flow is what the user sees, never the notice.
 * - `reset()`: the screen now shows a different id.
 */
import { useCallback, useRef } from 'react';

import { closeScreenQuietly, closeUnavailableScreen } from '../navigation/accessNotice';

type Navigation = Parameters<typeof closeUnavailableScreen>[0];

export interface UnavailableScreen {
  onNotFound: () => void;
  markOwnAction: () => void;
  reset: () => void;
}

export function useUnavailableScreen(navigation: Navigation): UnavailableScreen {
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const handledRef = useRef(false);
  const ownActionRef = useRef(false);

  const onNotFound = useCallback(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;
    if (ownActionRef.current) {
      closeScreenQuietly(navigationRef.current);
    } else {
      closeUnavailableScreen(navigationRef.current);
    }
  }, []);

  const markOwnAction = useCallback(() => {
    ownActionRef.current = true;
  }, []);

  const reset = useCallback(() => {
    handledRef.current = false;
    ownActionRef.current = false;
  }, []);

  return { onNotFound, markOwnAction, reset };
}
