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
import { rootNavigationRef } from './rootNavigationRef';

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
  | 'onboarding_done';

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

type TabName = 'Home' | 'Groups' | 'Tournaments' | 'Profile';

interface StackRoute {
  name: string;
  params?: object;
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
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate('Completion');
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

function listRoute(name: string, refreshKey?: number): StackRoute {
  if (refreshKey === undefined) {
    return { name };
  }
  return { name, params: { refreshKey } };
}

function applyTabStacks(focus: TabName, updates: Partial<Record<TabName, StackRoute[]>>): void {
  if (!navigationRef.isReady()) {
    return;
  }
  const state = navigationRef.getRootState();
  if (!state) {
    return;
  }
  const focusIndex = state.routes.findIndex(route => route.name === focus);
  navigationRef.reset({
    index: focusIndex >= 0 ? focusIndex : state.index ?? 0,
    routes: state.routes.map(route => {
      const next = updates[route.name as TabName];
      if (!next) {
        return route;
      }
      return {
        ...route,
        state: {
          index: next.length - 1,
          routes: next.map(item => ({ name: item.name, params: item.params })),
        },
      };
    }),
  } as never);
}

function focusTab(button: Action['button']): TabName {
  switch (button) {
    case 'groups':
    case 'view_group':
      return 'Groups';
    case 'profile':
      return 'Profile';
    case 'view_tournament':
      return 'Tournaments';
    case 'dashboard':
    case 'view_game':
    case 'signin':
    case 'get_started':
      return 'Home';
    default:
      return 'Home';
  }
}

function stacksFor(flow: CompletionFlow, action: Action): Partial<Record<TabName, StackRoute[]>> {
  const refreshKey = Date.now();
  const home = [listRoute('EventsList', refreshKey)];
  const groups = [listRoute('GroupsList', refreshKey)];
  const tournaments = [listRoute('TournamentsList', refreshKey)];
  const profile = [listRoute('ProfileHome')];

  switch (action.button) {
    case 'dashboard':
      return {
        Home: home,
        ...(flow === 'team_created' || flow === 'group_created' ? { Groups: groups } : {}),
        ...(flow === 'tournament_cancelled' ? { Tournaments: tournaments } : {}),
      };
    case 'groups':
      return { Groups: groups };
    case 'profile':
      return { Profile: profile };
    case 'view_game':
      return {
        Home: action.id
          ? [...home, { name: 'EventDetail', params: { eventId: action.id } }]
          : home,
      };
    case 'view_group':
      return {
        Groups: action.id
          ? [...groups, { name: 'GroupDetail', params: { groupId: action.id } }]
          : groups,
      };
    case 'view_tournament':
      return {
        Tournaments: action.id
          ? [...tournaments, { name: 'TournamentDetail', params: { tournamentId: action.id } }]
          : tournaments,
        ...(flow === 'tournament_created' ? { Home: home } : {}),
      };
    case 'signin':
    case 'get_started':
      return {};
    default:
      return {};
  }
}

function dismissCompletionRoute(): void {
  if (!rootNavigationRef.isReady()) {
    return;
  }
  if (rootNavigationRef.getCurrentRoute()?.name !== 'Completion') {
    return;
  }
  if (rootNavigationRef.canGoBack()) {
    rootNavigationRef.goBack();
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
    if (rootNavigationRef.isReady()) {
      const names = rootNavigationRef.getRootState()?.routeNames ?? [];
      if (names.includes('Login')) {
        rootNavigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
        );
      }
    }
    return;
  }

  if (navigationRef.isReady()) {
    applyTabStacks(focusTab(action.button), stacksFor(request.flow, action));
  }
  clearCompletion();
  dismissCompletionRoute();
}
