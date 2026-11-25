/**
 * App update check (DES-MEETUP-ADDENDUM-app-update-prompt 4.3). Fetches the version policy on launch and again each
 * time the app returns to the foreground, on Android and iOS, and decides: blocking screen, optional prompt, or
 * nothing (`decideUpdate`).
 *
 * Fails open (AD-9): anything other than a well-formed policy for this platform and a readable installed build means
 * "no prompt, not blocked". The optional prompt never interrupts typing: while the keyboard is open the prompt is
 * skipped for this check and offered again at the next launch or foreground check (4.3). Only error tags are logged,
 * never values.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { fetchVersionPolicy } from '../api/versionPolicy';
import type { UpdatePlatform } from '../api/versionPolicy';
import { perfLog } from '../diagnostics/perfLog';
import { reportUpdatePolicy } from '../links/linkGate';
import { decideUpdate, loadLater, NO_UPDATE, saveLater } from '../utils/appUpdate';
import type { UpdateDecision } from '../utils/appUpdate';
import { getInstalledBuild } from '../utils/installedVersion';

export interface AppUpdateState {
  decision: UpdateDecision;
  platform: UpdatePlatform;
  /** Later on the optional prompt: closes it and records the time and the dismissed latest build (AD-7). */
  dismissPrompt: () => void;
}

function currentPlatform(): UpdatePlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function keyboardOpen(): boolean {
  try {
    return Keyboard.isVisible();
  } catch {
    return false;
  }
}

export function useAppUpdate(): AppUpdateState {
  const platform = currentPlatform();
  const [decision, setDecision] = useState<UpdateDecision>(NO_UPDATE);
  // Only the most recently STARTED check may apply its result, so a slow
  // earlier response can never overwrite a newer one.
  const latestCheck = useRef(0);

  useEffect(() => {
    let active = true;

    const check = async (): Promise<void> => {
      latestCheck.current += 1;
      const thisCheck = latestCheck.current;

      const policy = await fetchVersionPolicy(); // never rejects; null = fail open
      const later = await loadLater(); // never rejects
      if (!active || thisCheck !== latestCheck.current) {
        return;
      }

      const platformPolicy = policy ? policy[platform] : null;
      const installed = getInstalledBuild(platform);
      if (platformPolicy && installed === null) {
        console.log('[update] installed version unreadable; not blocking');
      }
      let next = decideUpdate(platformPolicy, installed, later, policy?.reminderHours ?? 24, Date.now());
      // Deep links wait for this first answer (deep-links AD-6): the gate runs before any link.
      reportUpdatePolicy(next.kind === 'block');
      if (next.kind === 'prompt' && keyboardOpen()) {
        next = NO_UPDATE;
      }
      if (next.kind === 'prompt') {
        perfLog('update_prompt_shown');
      }
      setDecision(next);
    };

    // Launch. The listener is registered synchronously, before the first await.
    let previous: AppStateStatus = AppState.currentState ?? 'active';
    const subscription = AppState.addEventListener('change', next => {
      const returnedToForeground = next === 'active' && previous !== 'active';
      previous = next;
      if (returnedToForeground) {
        check();
      }
    });
    check();

    return () => {
      active = false;
      subscription.remove();
    };
  }, [platform]);

  const decisionRef = useRef<UpdateDecision>(NO_UPDATE);
  decisionRef.current = decision;

  const dismissPrompt = useCallback(() => {
    const current = decisionRef.current;
    if (current.kind !== 'prompt') {
      return;
    }
    perfLog('update_prompt_later');
    saveLater({ at: Date.now(), latestBuild: current.latestBuild });
    setDecision(NO_UPDATE);
  }, []);

  return { decision, platform, dismissPrompt };
}
