/**
 * Perf diagnostics hooks for screen-level timing (perf-diagnostics task, Item E).
 *
 * usePerfRender(name): counts renders per screen visit and logs render_count.
 * usePerfScreen(name): logs tap_to_focus_ms (from last nav state change) and
 *   first_content_ms (from focus to first isLoading=false render).
 *
 * These are NO-OPs (zero allocation) when diagnostics is OFF.
 */
import { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { perfLog, isPerfCapturing, now } from '../diagnostics/perfLog';

// ── Module-level: last navigation state-change timestamp ────────────────────
// Written by RootNavigator's onStateChange (see RootNavigator.tsx).
// Read by usePerfScreen to compute tap_to_focus_ms.
let _lastNavChangeT = 0;

/** Called by RootNavigator.onStateChange to record the nav event time. */
export function recordNavChange(routeName: string): void {
  if (!isPerfCapturing()) {
    return;
  }
  _lastNavChangeT = now();
  perfLog('nav_state_change', { route: routeName });
}

// ── usePerfRender ─────────────────────────────────────────────────────────
/**
 * Counts how many times the screen component re-renders during a visit and
 * logs `render_count` on unmount. No-op when OFF.
 */
export function usePerfRender(screenName: string): void {
  const renderCount = useRef(0);
  const isEnabled = isPerfCapturing();

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    renderCount.current = 0;
  }, [isEnabled]);

  // Increment on every render (synchronous, no state change).
  if (isEnabled) {
    renderCount.current++;
  }

  // Log on unmount.
  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    return () => {
      perfLog('render_count', { screen: screenName, count: renderCount.current });
    };
  }, [isEnabled, screenName]);
}

// ── usePerfScreen ─────────────────────────────────────────────────────────
/**
 * Logs screen timing on focus:
 *   - tap_to_focus_ms: time from the last nav state change to this focus event.
 *   - first_content_ms: time from focus to the first render where isLoading is false.
 *
 * `isLoading` should be true while data is being fetched and false when content
 * is ready to display.
 */
export function usePerfScreen(screenName: string, isLoading: boolean): void {
  const focusT = useRef(0);
  const firstContentLogged = useRef(false);
  const isEnabled = isPerfCapturing();

  useFocusEffect(
    useCallback(() => {
      if (!isEnabled) {
        return;
      }
      // Reset per-visit state.
      focusT.current = now();
      firstContentLogged.current = false;

      const tapToFocusMs =
        _lastNavChangeT > 0 ? Math.round((focusT.current - _lastNavChangeT) * 10) / 10 : undefined;
      perfLog('screen_focus', { screen: screenName, tap_to_focus_ms: tapToFocusMs });
    }, [isEnabled, screenName]),
  );

  // Log first_content_ms as soon as isLoading becomes false after focus.
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    if (!isLoading && focusT.current > 0 && !firstContentLogged.current) {
      firstContentLogged.current = true;
      const first_content_ms = Math.round((now() - focusT.current) * 10) / 10;
      perfLog('first_content', { screen: screenName, first_content_ms });
    }
  }, [isEnabled, isLoading, screenName]);
}
