/**
 * Auth context (DES-MEETUP-MOBILE.md §3.5, §4.2, §5.1; R-010, R-012,
 * R-013, R-016).
 *
 * On mount (and when the app resumes while the splash retry state is
 * showing): restore the session (R-016 "renew automatically wherever
 * possible"). A stored access token is sent to `GET /users/me`. If the
 * Keychain read fails, or there is no access token, `POST /auth/refresh`
 * runs against the refresh cookie. Only a definitive auth rejection
 * (refresh 401 / `SessionEndedError` 'rejected' or 'no-session', or a 401
 * on a retried request) ends the session and routes to login. Network
 * errors, timeouts, 5xx, 429, and a refresh that failed the same way are
 * retried with bounded backoff, then left on the splash retry state —
 * tokens and the cookie are not cleared.
 *
 * On a persistent `auth-expired` event from the API client (§3.4/§3.5's
 * refresh-and-retry flow exhausted), clears `user` — the root navigator
 * (§7 wiring) reacts to `user` becoming `null` by switching back to the
 * Auth Stack.
 *
 * Push registration (§3.6) is driven from here: whenever a session exists
 * — fresh sign-in by any method or a restored session — permission +
 * device-token registration start, and they stop when the session ends
 * (sign-out, `auth-expired`, unmount). See `notifications/pushRegistration`.
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
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { apiClient, endSession, refreshAccessToken, SessionEndedError } from '../api/client';
import { authEvents } from '../api/authEvents';
import { logRouteToLogin } from '../api/loginRouteLog';
import { getAccessToken } from '../storage/tokens';
import { delay, isAbortError } from '../utils/delay';
import { describeError } from '../utils/logSafeError';
import {
  isTransientRestoreFailure,
  restoreFailureOf,
  SESSION_RESTORE_BACKOFF_MS,
  SESSION_RESTORE_MAX_ATTEMPTS,
  sessionCheckFailureKind,
} from './sessionRestore';
import type { SessionCheckFailure } from './sessionRestore';
import {
  configureGoogleSignIn,
  signIn as googleSignIn,
  signOut as sharedSignOut,
} from './googleAuth';
import { isGoogleSignInAvailable } from './googleSupport';
import { signIn as appleSignIn } from './appleAuth';
import { login as emailLogin } from './emailAuth';
import { startPushRegistration } from '../notifications/pushRegistration';
import type { UserProfile } from '../types/user';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  /**
   * True after a signed-in session was ended by `auth-expired` (the API client
   * could not renew it). The Sign In screen shows `SESSION_EXPIRED_MESSAGE`.
   * Never set by a failed sign-in attempt or a user-initiated sign-out.
   */
  sessionExpired: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * True when startup/resume could not confirm the session because of a
   * transient failure. The splash shows a Retry action; the user is not
   * sent to login and stored tokens / the refresh cookie are left intact.
   */
  sessionCheckPendingRetry: boolean;
  /** Which bundled error label the splash retry state should show. */
  sessionCheckFailure: SessionCheckFailure;
  /** Runs the startup check again (same bounded retries as the automatic pass). */
  retrySessionCheck: () => void;
  /**
   * Merges fields into the in-memory user (e.g. a `display_name` the user
   * just saved on Profile) so screens reading `useAuth().user` — the Home
   * greeting — reflect it without a restart. Purely local; the backend is
   * already updated by the caller.
   */
  updateUser: (patch: Partial<UserProfile>) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type RestoreOutcome =
  | { kind: 'ready' }
  | { kind: 'signed-out' }
  | { kind: 'aborted' }
  | { kind: 'give-up'; error: unknown };

function readAppState(): AppStateStatus {
  const current = AppState.currentState;
  if (
    current === 'active' ||
    current === 'background' ||
    current === 'inactive' ||
    current === 'unknown' ||
    current === 'extension'
  ) {
    return current;
  }
  return 'active';
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionCheckPendingRetry, setSessionCheckPendingRetry] = useState(false);
  const [sessionCheckFailure, setSessionCheckFailure] = useState<SessionCheckFailure>('server');
  // True while a session exists or is being restored. `auth-expired` also
  // fires for a 401 on a sign-in attempt (wrong password), which is not an
  // expired session and must not raise the notice.
  const hadSessionRef = useRef(false);
  const stopPushRegistrationRef = useRef<(() => void) | null>(null);
  const pendingRetryRef = useRef(false);
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const userId = user?.id ?? null;

  const runSessionRestore = useCallback(async (signal: AbortSignal) => {
    const runId = ++runIdRef.current;
    pendingRetryRef.current = false;
    setIsLoading(true);
    setSessionCheckPendingRetry(false);

    const stillCurrent = (): boolean => !signal.aborted && runId === runIdRef.current;

    const restoreOnce = async (): Promise<RestoreOutcome> => {
      if (isGoogleSignInAvailable()) {
        configureGoogleSignIn();
      }

      let accessToken: string | null = null;
      try {
        accessToken = await getAccessToken();
      } catch (error) {
        // The Keychain/Keystore read itself failed (e.g. an invalidated key).
        // The refresh token is a cookie the networking layer still sends, so
        // try POST /auth/refresh. Only an error tag is logged, never a value.
        // The splash cannot hang: a transient result ends on the retry state.
        console.log('[auth] stored token unreadable; attempting refresh', describeError(error));
      }
      if (!stillCurrent()) {
        return { kind: 'aborted' };
      }

      let refreshedToken: string | null = null;
      if (!accessToken) {
        // No readable access token, but the 30-day refresh cookie may still
        // be alive (mirrors the PWA's silent refresh on load).
        try {
          const token = await refreshAccessToken();
          if (!stillCurrent()) {
            return { kind: 'aborted' };
          }
          if (typeof token === 'string' && token.length > 0) {
            refreshedToken = token;
            hadSessionRef.current = true;
          } else {
            return { kind: 'give-up', error: new Error('refresh returned no token') };
          }
        } catch (error) {
          if (!stillCurrent()) {
            return { kind: 'aborted' };
          }
          if (error instanceof SessionEndedError) {
            if (error.reason === 'rejected') {
              // A cookie existed and the backend rejected it (invalid, expired
              // or reused): a real session just ended, so tell the user.
              logRouteToLogin('refresh-rejected', 401);
              hadSessionRef.current = true;
              await endSession();
            } else {
              // `{ access_token: null }` is "never signed in" when we had no
              // access token — route to login, no notice, cookies left as they
              // are (endSession is not called on this path).
              logRouteToLogin('refresh-no-session', 200);
              hadSessionRef.current = false;
              setSessionExpired(false);
              setUser(null);
            }
            return { kind: 'signed-out' };
          }
          return { kind: 'give-up', error };
        }
      } else {
        hadSessionRef.current = true;
      }

      if (!stillCurrent()) {
        return { kind: 'aborted' };
      }

      let sessionEnded = false;
      const stopWatching = authEvents.on('auth-expired', () => {
        sessionEnded = true;
      });
      try {
        // When the Keychain could not be read, pass the token the refresh
        // just returned. The request interceptor keeps that header if a
        // later read throws, instead of dropping the call.
        const { data } = await apiClient.get<UserProfile>(
          '/users/me',
          refreshedToken ? { headers: { Authorization: `Bearer ${refreshedToken}` } } : undefined,
        );
        if (sessionEnded) {
          return { kind: 'signed-out' };
        }
        if (!stillCurrent()) {
          return { kind: 'aborted' };
        }
        setSessionExpired(false);
        setUser(data);
        return { kind: 'ready' };
      } catch (error) {
        if (sessionEnded) {
          // The client already called endSession() and logged the cause
          // (refresh rejected, no-session, or a 401 on the retried request).
          return { kind: 'signed-out' };
        }
        return { kind: 'give-up', error: restoreFailureOf(error) };
      } finally {
        stopWatching();
      }
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= SESSION_RESTORE_MAX_ATTEMPTS; attempt += 1) {
      if (!stillCurrent()) {
        return;
      }
      let outcome: RestoreOutcome;
      try {
        outcome = await restoreOnce();
      } catch (error) {
        if (isAbortError(error) || !stillCurrent()) {
          return;
        }
        // Not an auth rejection. Keep tokens and show the retry state so
        // the splash cannot hang.
        console.log('[auth] session restore attempt failed; session kept', describeError(error));
        outcome = { kind: 'give-up', error };
      }
      if (!stillCurrent()) {
        return;
      }
      if (outcome.kind === 'aborted') {
        return;
      }
      if (outcome.kind === 'ready' || outcome.kind === 'signed-out') {
        pendingRetryRef.current = false;
        setSessionCheckPendingRetry(false);
        setIsLoading(false);
        return;
      }

      lastError = outcome.error;
      const failure = restoreFailureOf(lastError);
      const willRetry = isTransientRestoreFailure(failure) && attempt < SESSION_RESTORE_MAX_ATTEMPTS;
      if (!willRetry) {
        pendingRetryRef.current = true;
        setSessionCheckFailure(sessionCheckFailureKind(failure));
        setSessionCheckPendingRetry(true);
        setIsLoading(false);
        console.log(
          '[auth] session check paused; session kept',
          sessionCheckFailureKind(failure),
          describeError(failure),
        );
        return;
      }
      try {
        await delay(SESSION_RESTORE_BACKOFF_MS[attempt - 1], signal);
      } catch (error) {
        if (isAbortError(error) || !stillCurrent()) {
          return;
        }
        throw error;
      }
    }
  }, []);

  const beginSessionRestore = useCallback(() => {
    const next = new AbortController();
    abortRef.current?.abort();
    abortRef.current = next;
    runSessionRestore(next.signal).catch(error => {
      console.log('[auth] session restore failed; session kept', describeError(error));
    });
  }, [runSessionRestore]);

  useEffect(() => {
    beginSessionRestore();

    const unsubscribe = authEvents.on('auth-expired', () => {
      if (hadSessionRef.current) {
        hadSessionRef.current = false;
        setSessionExpired(true);
      }
      setUser(null);
      // A definitive end leaves the splash retry state and shows login.
      pendingRetryRef.current = false;
      setSessionCheckPendingRetry(false);
    });

    let previous = readAppState();
    const subscription = AppState.addEventListener('change', next => {
      const resumed = next === 'active' && previous !== 'active';
      previous = next;
      // Resume while the retry splash is up: try the check again. A signed-in
      // session is not re-run here — in-session 401s already keep the session
      // when the refresh fails transiently (see api/client.ts).
      if (resumed && pendingRetryRef.current) {
        beginSessionRestore();
      }
    });

    return () => {
      abortRef.current?.abort();
      unsubscribe();
      subscription.remove();
    };
  }, [beginSessionRestore]);

  // Keyed on the user id, not the user object, so `updateUser` patches
  // (e.g. a new display name) do not restart registration.
  useEffect(() => {
    if (userId === null) {
      return undefined;
    }
    const stop = startPushRegistration();
    stopPushRegistrationRef.current = stop;
    return () => {
      stop();
      stopPushRegistrationRef.current = null;
    };
  }, [userId]);

  // Common tail of every successful sign-in: a session now exists.
  const establishSession = useCallback((profile: UserProfile) => {
    hadSessionRef.current = true;
    setSessionExpired(false);
    setUser(profile);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSessionExpired(false);
    establishSession(await googleSignIn());
  }, [establishSession]);

  const signInWithApple = useCallback(async () => {
    setSessionExpired(false);
    establishSession(await appleSignIn());
  }, [establishSession]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setSessionExpired(false);
      establishSession(await emailLogin(email, password));
    },
    [establishSession],
  );

  const signOut = useCallback(async () => {
    // Stop first: a foreground event between the token de-registration and
    // the user clearing must not re-register this device.
    stopPushRegistrationRef.current?.();
    // A user-initiated sign-out is not an expiry, even if the best-effort
    // `POST /auth/logout` hits a 401 and the client emits `auth-expired`.
    hadSessionRef.current = false;
    try {
      await sharedSignOut();
    } finally {
      // Local state always clears, even if a local step of sign-out failed.
      setSessionExpired(false);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((patch: Partial<UserProfile>) => {
    setUser(current => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      sessionExpired,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signOut,
      sessionCheckPendingRetry,
      sessionCheckFailure,
      retrySessionCheck: beginSessionRestore,
      updateUser,
    }),
    [
      user,
      isLoading,
      sessionExpired,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signOut,
      sessionCheckPendingRetry,
      sessionCheckFailure,
      beginSessionRestore,
      updateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
