/**
 * Auth context (DES-MEETUP-MOBILE.md §3.5, §4.2, §5.1; R-010, R-012,
 * R-013, R-016).
 *
 * On mount: if a token already exists in Keystore, fetch `GET /users/me`
 * to restore the session (R-016 "renew automatically wherever
 * possible"). On a persistent `auth-expired` event from the API client
 * (§3.4/§3.5's refresh-and-retry flow exhausted), clears `user` — the
 * root navigator (§7 wiring) reacts to `user` becoming `null` by
 * switching back to the Auth Stack.
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

import { apiClient, endSession, refreshAccessToken, SessionEndedError } from '../api/client';
import { authEvents } from '../api/authEvents';
import { getAccessToken } from '../storage/tokens';
import { describeError } from '../utils/logSafeError';
import { configureGoogleSignIn, signIn as googleSignIn, signOut as sharedSignOut } from './googleAuth';
import { login as emailLogin, register as emailRegister } from './emailAuth';
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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, nickname: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Merges fields into the in-memory user (e.g. a `display_name` the user
   * just saved on Profile) so screens reading `useAuth().user` — the Home
   * greeting — reflect it without a restart. Purely local; the backend is
   * already updated by the caller.
   */
  updateUser: (patch: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // True while a session exists or is being restored. `auth-expired` also
  // fires for a 401 on a sign-in attempt (wrong password), which is not an
  // expired session and must not raise the notice.
  const hadSessionRef = useRef(false);
  const stopPushRegistrationRef = useRef<(() => void) | null>(null);
  const userId = user?.id ?? null;

  const restoreStoredSession = useCallback(async () => {
    configureGoogleSignIn();

    let accessToken: string | null = null;
    try {
      accessToken = await getAccessToken();
    } catch (error) {
      // The Keychain/Keystore read itself failed (e.g. an invalidated key).
      // Treat it as "no stored session" and carry on to the login screen —
      // never let it stall start-up. Only an error tag is logged, never a value.
      console.log('[auth] stored token unreadable; treating as signed out', describeError(error));
    }
    if (!accessToken) {
      // No access token, but the 30-day refresh cookie may still be alive
      // (mirrors the PWA's silent refresh on load). Only the networking layer
      // can see that cookie, so ask the backend once.
      try {
        await refreshAccessToken();
        hadSessionRef.current = true;
        const { data } = await apiClient.get<UserProfile>('/users/me');
        setUser(data);
      } catch (error) {
        if (error instanceof SessionEndedError && error.reason === 'rejected') {
          // A cookie existed and the backend rejected it (invalid, expired or
          // reused): a real session just ended, so tell the user. A null
          // token (`no-session`) is simply "never signed in" — no notice.
          hadSessionRef.current = true;
          await endSession();
        }
        hadSessionRef.current = false;
        setUser(null);
      }
    } else {
      hadSessionRef.current = true;
      try {
        const { data } = await apiClient.get<UserProfile>('/users/me');
        setUser(data);
      } catch {
        // Token present but the profile fetch failed — either a network
        // error, or a persistent 401 already handled by the client's
        // refresh-and-retry flow (which emits `auth-expired`, handled
        // below). Fail closed either way: no user is set, and the root
        // navigator falls back to the Auth Stack. Any `auth-expired` has
        // already been handled synchronously by the time this runs.
        hadSessionRef.current = false;
        setUser(null);
      }
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      await restoreStoredSession();
    } catch (error) {
      // Fail closed: an unexpected start-up error means "signed out", not a crash.
      console.log('[auth] session restore failed; continuing signed out', describeError(error));
    } finally {
      // Whatever happens above, never leave the splash hanging.
      setIsLoading(false);
    }
  }, [restoreStoredSession]);

  useEffect(() => {
    restoreSession();

    const unsubscribe = authEvents.on('auth-expired', () => {
      if (hadSessionRef.current) {
        hadSessionRef.current = false;
        setSessionExpired(true);
      }
      setUser(null);
    });
    return unsubscribe;
  }, [restoreSession]);

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

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setSessionExpired(false);
      establishSession(await emailLogin(email, password));
    },
    [establishSession],
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, nickname: string) => {
      setSessionExpired(false);
      establishSession(await emailRegister(email, password, nickname));
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
      signInWithEmail,
      registerWithEmail,
      signOut,
      updateUser,
    }),
    [
      user,
      isLoading,
      sessionExpired,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      signOut,
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
