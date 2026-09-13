/**
 * Minimal internal pub/sub for auth lifecycle events.
 *
 * Kept dependency-free (no Node `events` polyfill assumed present under
 * Metro) rather than reaching for a package to satisfy a two-method need.
 * `client.ts` emits `auth-expired` when a persistent 401 (failed refresh)
 * occurs; `RootNavigator` (or a future top-level auth listener) subscribes
 * to force a return to the Auth Stack.
 */

export type AuthEvent = 'auth-expired';

type Listener = () => void;

class AuthEventEmitter {
  private listeners: Record<AuthEvent, Set<Listener>> = {
    'auth-expired': new Set(),
  };

  on(event: AuthEvent, listener: Listener): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  emit(event: AuthEvent): void {
    this.listeners[event].forEach(listener => listener());
  }
}

export const authEvents = new AuthEventEmitter();
