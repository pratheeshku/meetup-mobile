/**
 * Loads what the mobile number field needs: the current consent text and
 * the country list (DES-MEETUP-ADDENDUM-profile-onboarding.md AD-3, AD-9,
 * §7). If either fails (or the list is empty) the status is `unavailable`
 * and screens HIDE the number field and carry on without it — never block.
 *
 * The default country is the FIRST row of the list (AD-9 v1.3); no other
 * source is read for it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { getCountryCodes, getMobileConsent } from '../api/mobileNumber';
import type { CountryCode, MobileConsent } from '../api/mobileNumber';

export type MobileNumberConfig =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      consent: MobileConsent;
      countries: CountryCode[];
      /** First row of the server list. */
      defaultCountry: CountryCode;
      /** Refetches the consent text (after a 409 `consent_version_stale`). */
      reloadConsent: () => Promise<boolean>;
    };

export function useMobileNumberConfig(): MobileNumberConfig {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; consent: MobileConsent; countries: CountryCode[] }
  >({ status: 'loading' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    withCorrelationId(async correlationId => {
      try {
        const [consent, countries] = await Promise.all([
          getMobileConsent({ correlationId }),
          getCountryCodes({ correlationId }),
        ]);
        if (!mounted.current) {
          return;
        }
        if (!consent?.version || !consent.text || countries.length === 0) {
          setState({ status: 'unavailable' });
          return;
        }
        setState({ status: 'ready', consent, countries });
      } catch {
        if (mounted.current) {
          setState({ status: 'unavailable' });
        }
      }
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const reloadConsent = useCallback(async (): Promise<boolean> => {
    try {
      const consent = await withCorrelationId(correlationId => getMobileConsent({ correlationId }));
      if (!mounted.current) {
        return false;
      }
      setState(previous => (previous.status === 'ready' ? { ...previous, consent } : previous));
      return true;
    } catch {
      return false;
    }
  }, []);

  if (state.status !== 'ready') {
    return state;
  }
  return {
    status: 'ready',
    consent: state.consent,
    countries: state.countries,
    defaultCountry: state.countries[0],
    reloadConsent,
  };
}
