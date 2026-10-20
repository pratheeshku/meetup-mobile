/**
 * User details menu: the opener side (DES-MEETUP-ADDENDUM-user-details-menu AD-4).
 *
 * `useUserMenu(context, onChanged)` is what a call site (via `UserPressable`) uses: it returns
 * `openDetails` (avatar tap: View Details) and `openMenu` (long-press: View Details plus the
 * server's actions). Both put one request into a tiny external store (same shape as
 * `navigation/accessNotice.ts`). ONE `UserMenuHost`, mounted at the root, serves the request:
 * `useUserMenuEngine` owns the card fetch, the action registry, the confirmation and the
 * execution. One sheet for the whole app, not one Modal per row.
 */
import { useCallback, useRef } from 'react';

export type UserMenuContextType = 'group' | 'game' | 'tournament' | 'none';

export interface UserMenuContext {
  type: UserMenuContextType;
  /** Group or game id; absent for `tournament` and `none`. */
  id?: string | null;
}

/** Identity taken from the row the person was shown in. */
export interface UserMenuPerson {
  /** Absent when the row has no user (for example a tournament registration without one). */
  userId: string | null;
  displayName: string;
  /** `null` or empty: known to have none (shows the `no_nickname` label). Absent: the row does not carry it (nothing shown). */
  nickname?: string | null;
  photoUrl: string | null;
  /** A person with no linked account: placeholder picture. */
  noUser?: boolean;
}

export type UserMenuMode = 'details' | 'menu';

export interface UserMenuRequest {
  person: UserMenuPerson;
  mode: UserMenuMode;
  context: UserMenuContext;
  /** Called after an action, or a 404 from the card: the host screen refetches. */
  onChanged?: () => void;
  seq: number;
}

type Listener = () => void;

let current: UserMenuRequest | null = null;
let seq = 0;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(listener => listener());
}

export function getUserMenuRequest(): UserMenuRequest | null {
  return current;
}

export function subscribeToUserMenu(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function closeUserMenu(): void {
  if (current) {
    current = null;
    emit();
  }
}

export function openUserMenu(request: Omit<UserMenuRequest, 'seq'>): void {
  seq += 1;
  current = { ...request, seq };
  emit();
}

export interface UserMenuOpener {
  openDetails: (person: UserMenuPerson) => void;
  openMenu: (person: UserMenuPerson) => void;
}

export function useUserMenu(context: UserMenuContext, onChanged?: () => void): UserMenuOpener {
  // Latest values without changing the opener identity on every render.
  const contextRef = useRef(context);
  contextRef.current = context;
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const open = useCallback((mode: UserMenuMode, person: UserMenuPerson) => {
    openUserMenu({
      person,
      mode,
      context: contextRef.current,
      onChanged: () => onChangedRef.current?.(),
    });
  }, []);

  const openDetails = useCallback((person: UserMenuPerson) => open('details', person), [open]);
  const openMenu = useCallback((person: UserMenuPerson) => open('menu', person), [open]);
  return { openDetails, openMenu };
}
