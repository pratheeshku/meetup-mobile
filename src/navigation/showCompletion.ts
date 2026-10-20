/**
 * Opens the root Completion screen with a summary held only in memory.
 *
 * The payload is the submitted form / API response the caller already has.
 * Nothing here is written to AsyncStorage, and nothing is logged (summaries
 * can contain names, email, and phone numbers).
 *
 * `account_deleted` also arms a one-shot handoff. Sign-out swaps the root
 * navigator for the Auth stack; that stack claims the handoff once and
 * shows the same summary. Dismiss clears it.
 */
import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '../notifications/notificationRouting';
import { clearGroupCreateDraft } from './groupCreateDraft';

export type CompletionFlow =
  | 'game_created'
  | 'tournament_created'
  | 'team_created'
  | 'group_created'
  | 'game_updated'
  | 'group_updated'
  | 'profile_updated'
  | 'skills_updated'
  | 'game_cancelled'
  | 'tournament_cancelled'
  | 'group_deleted'
  | 'group_left'
  | 'account_created'
  | 'account_deleted'
  | 'onboarding_done'
  | 'game_closed'
  | 'tournament_closed';

export type CompletionPrimary = 'dashboard' | 'groups' | 'profile' | 'signin' | 'get_started';

export type CompletionSecondaryButton = 'view_game' | 'view_group' | 'view_tournament';

export interface CompletionRow {
  label: string;
  value: string;
}

export interface CompletionSecondary {
  button: CompletionSecondaryButton;
  id: string;
}

export interface CompletionRequest {
  flow: CompletionFlow;
  rows: CompletionRow[];
  primary: CompletionPrimary;
  secondary?: CompletionSecondary;
  /** Overlay flows (onboarding) run this instead of navigating. */
  onPrimary?: () => void;
}

type Action =
  | { button: CompletionPrimary }
  | { button: CompletionSecondaryButton; id?: string };

let pending: CompletionRequest | null = null;
let authHandoff: CompletionRequest | null = null;
/** Sticky so a strict-mode double init of the Auth stack sees the same route. */
let authHandoffClaimed = false;
let authHandoffClaim: CompletionRequest | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach(listener => listener());
}

export function subscribeCompletion(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function peekCompletion(): CompletionRequest | null {
  return pending;
}

export function showCompletion(request: CompletionRequest): void {
  pending = request;
  if (request.flow === 'account_deleted') {
    authHandoff = request;
    authHandoffClaimed = false;
  }
  emit();
  if (navigationRef.isReady()) {
    navigationRef.navigate('Completion' as never);
  }
}

/** First Auth-stack mount after deletion. Later reads return the same claim. */
export function claimAuthHandoff(): CompletionRequest | null {
  if (!authHandoffClaimed) {
    authHandoffClaimed = true;
    authHandoffClaim = authHandoff;
    authHandoff = null;
  }
  return authHandoffClaim;
}

export function clearCompletion(): void {
  pending = null;
  authHandoff = null;
  authHandoffClaim = null;
  authHandoffClaimed = true;
  emit();
}

function dismissCompletionRoute(): void {
  if (!navigationRef.isReady()) {
    return;
  }
  const routeName = navigationRef.getCurrentRoute()?.name as string | undefined;
  if (routeName !== 'Completion') {
    return;
  }
  if (navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

/**
 * `pop: true` unwinds to a screen already in that stack (same as
 * `goToDashboard`). The detail is opened on the next turn, after that
 * pop, so Back from the detail does not return to the form.
 */
function openGame(eventId: string): void {
  navigationRef.navigate('Home', {
    screen: 'EventsList',
    params: { refreshKey: Date.now() },
    pop: true,
  });
  setTimeout(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    navigationRef.navigate('Home', {
      screen: 'EventDetail',
      params: { eventId },
      pop: true,
    });
  }, 0);
}

function openGroup(groupId: string): void {
  navigationRef.navigate('Groups', {
    screen: 'GroupsList',
    params: { refreshKey: Date.now() },
    pop: true,
  });
  setTimeout(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    navigationRef.navigate('Groups', {
      screen: 'GroupDetail',
      params: { groupId },
      pop: true,
    });
  }, 0);
}

function goToTarget(flow: CompletionFlow, action: Action): void {
  if (!navigationRef.isReady()) {
    return;
  }
  const refreshKey = Date.now();
  switch (action.button) {
    case 'dashboard':
      if (flow === 'team_created' || flow === 'group_created') {
        navigationRef.navigate('Groups', {
          screen: 'GroupsList',
          params: { refreshKey },
          pop: true,
        });
      }
      if (flow === 'tournament_cancelled') {
        navigationRef.navigate('Tournaments', {
          screen: 'TournamentsList',
          params: { refreshKey },
          pop: true,
        });
      }
      navigationRef.navigate('Home', {
        screen: 'EventsList',
        params: { refreshKey },
        pop: true,
      });
      return;
    case 'groups':
      navigationRef.navigate('Groups', {
        screen: 'GroupsList',
        params: { refreshKey },
        pop: true,
      });
      return;
    case 'profile':
      navigationRef.navigate('Profile', {
        screen: 'ProfileHome',
        pop: true,
      });
      return;
    case 'view_game':
      if (action.id) {
        openGame(action.id);
      }
      return;
    case 'view_group':
      if (action.id) {
        openGroup(action.id);
      }
      return;
    case 'view_tournament':
      if (flow === 'tournament_created') {
        navigationRef.navigate('Home', {
          screen: 'EventsList',
          params: { refreshKey },
          pop: true,
        });
      }
      if (action.id) {
        navigationRef.navigate('Tournaments', {
          screen: 'TournamentDetail',
          params: { tournamentId: action.id },
          pop: true,
        });
      }
      return;
    case 'signin':
    case 'get_started':
      return;
    default:
      return;
  }
}

/**
 * Hardware back and both buttons call this. The form stack underneath is
 * replaced, so the user cannot land back on it and submit again.
 */
export function leaveCompletion(request: CompletionRequest, which: 'primary' | 'secondary'): void {
  const action: Action | null =
    which === 'primary' ? { button: request.primary } : request.secondary ?? null;
  if (!action) {
    return;
  }

  if (request.flow === 'group_created') {
    clearGroupCreateDraft();
  }

  if (action.button === 'get_started') {
    clearCompletion();
    request.onPrimary?.();
    return;
  }

  if (action.button === 'signin') {
    clearCompletion();
    if (navigationRef.isReady()) {
      const state = navigationRef.getRootState();
      const names = (state?.routeNames ?? []) as readonly string[];
      if (names.includes('Login')) {
        const loginInStack = state?.routes.some(route => route.name === 'Login') ?? false;
        if (loginInStack) {
          navigationRef.dispatch(CommonActions.navigate('Login', undefined, { pop: true }));
        } else {
          navigationRef.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
          );
        }
      }
    }
    return;
  }

  clearCompletion();
  goToTarget(request.flow, action);
  dismissCompletionRoute();
}
