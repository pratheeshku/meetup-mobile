/**
 * Save/clear logic for the mobile number, shared by the Profile screen and
 * the first-run step (DES-MEETUP-ADDENDUM-profile-onboarding.md AD-3, §5):
 *
 * - Setting a number sends `mobile_number` + the current
 *   `mobile_consent_version` from the consent endpoint.
 * - Clearing sends `mobile_number: null` only.
 * - 409 (`consent_version_stale`): refetch the consent text and ask the user
 *   to confirm again (`needsReconfirm`); the next save uses the fresh version.
 * - 422: an inline, fixed-copy error that never echoes the submitted value.
 *
 * Nothing here logs the number.
 */
import { useCallback, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { classifyMobileNumberError, updateMobileNumber } from '../api/mobileNumber';
import type { MobileNumberConfig } from './useMobileNumberConfig';
import { useT } from '../labels/LabelsContext';

type ReadyConfig = Extract<MobileNumberConfig, { status: 'ready' }>;

export interface MobileNumberSave {
  isSaving: boolean;
  error: string | null;
  /** True after a 409: the consent text was refreshed and needs a fresh confirm. */
  needsReconfirm: boolean;
  /** Resolves true when the server accepted the change. */
  save: (e164: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  /** Clears the error state (e.g. when the user edits the field). */
  resetError: () => void;
}

export function useMobileNumberSave(config: ReadyConfig): MobileNumberSave {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconfirm, setNeedsReconfirm] = useState(false);
  // The save handler must read the version current at press time, which
  // changes after a 409 refetch.
  const configRef = useRef(config);
  configRef.current = config;
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const run = useCallback(
    async (payload: { mobile_number: string | null; mobile_consent_version?: string }) => {
      setIsSaving(true);
      setError(null);
      try {
        await withCorrelationId(correlationId => updateMobileNumber(payload, { correlationId }));
        setNeedsReconfirm(false);
        return true;
      } catch (failure) {
        const kind = classifyMobileNumberError(failure);
        if (kind === 'consent_version_stale') {
          await configRef.current.reloadConsent();
          setNeedsReconfirm(true);
          setError(tRef.current('mob.mobile_number.reconfirm'));
        } else if (kind === 'invalid_number') {
          setError(tRef.current('mob.mobile_number.invalid'));
        } else {
          setError(tRef.current('mob.mobile_number.save_failed'));
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const save = useCallback(
    (e164: string) =>
      run({
        mobile_number: e164,
        mobile_consent_version: configRef.current.consent.version,
      }),
    [run],
  );
  const clear = useCallback(() => run({ mobile_number: null }), [run]);
  const resetError = useCallback(() => setError(null), []);

  return { isSaving, error, needsReconfirm, save, clear, resetError };
}
