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

import { apiClient } from '../api/client';
import { authEvents } from '../api/authEvents';
import { getAccessToken } from '../storage/tokens';
import { configureGoogleSignIn, signIn as googleSignIn, signOut as sharedSignOut } from './googleAuth';
import { login as emailLogin, register as emailRegister } from './emailAuth';
import { startPushRegistration } from '../notifications/pushRegistration';
import type { UserProfile } from '../types/user';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
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
  const stopPushRegistrationRef = useRef<(() => void) | null>(null);
  const userId = user?.id ?? null;

  const restoreSession = useCallback(async () => {
    configureGoogleSignIn();

    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const { data } = await apiClient.get<UserProfile>('/users/me');
        setUser(data);
      } catch {
        // Token present but the profile fetch failed — either a network
        // error, or a persistent 401 already handled by the client's
        // refresh-and-retry flow (which emits `auth-expired`, handled
        // below). Fail closed either way: no user is set, and the root
        // navigator falls back to the Auth Stack.
        setUser(null);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    restoreSession();

    const unsubscribe = authEvents.on('auth-expired', () => {
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

  const signInWithGoogle = useCallback(async () => {
    const profile = await googleSignIn();
    setUser(profile);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const profile = await emailLogin(email, password);
    setUser(profile);
  }, []);

  const registerWithEmail = useCallback(
    async (email: string, password: string, nickname: string) => {
      const profile = await emailRegister(email, password, nickname);
      setUser(profile);
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Stop first: a foreground event between the token de-registration and
    // the user clearing must not re-register this device.
    stopPushRegistrationRef.current?.();
    try {
      await sharedSignOut();
    } finally {
      // Local state always clears, even if a local step of sign-out failed.
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
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      signOut,
      updateUser,
    }),
    [user, isLoading, signInWithGoogle, signInWithEmail, registerWithEmail, signOut, updateUser],
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
