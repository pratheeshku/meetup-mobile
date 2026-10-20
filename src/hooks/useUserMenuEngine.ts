/**
 * The engine behind the single `UserMenuHost` (DES-MEETUP-ADDENDUM-user-details-menu AD-4, AD-5).
 *
 * - View Details shows at once from the row identity.
 * - On a menu open (never on a tap) for a group or game person other than the viewer, the card is
 *   fetched, every time, never cached. Actions appear only after a successful fetch and only
 *   those the server listed that this app knows for the context. `requires_approval` actions are
 *   dropped (none exist in v1).
 * - Card failure or timeout: View Details only plus the `card_load_failed` message.
 * - A 404 (card or action): the menu closes, the shared "no longer available" notice shows and the
 *   host screen refetches.
 * - Context `tournament` and `none`, the viewer's own row and a person with no id: no card request.
 * - One correlation id covers the card fetch and the action it leads to.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getEventPlayerCard } from '../api/events';
import { getGroupMemberCard } from '../api/groups';
import { withCorrelationId } from '../api/correlationId';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../labels/LabelsContext';
import { showAccessNotice } from '../navigation/accessNotice';
import type { UserCardOut } from '../types/userCard';
import { getApiErrorMessage, isNotFoundError } from '../utils/apiError';
import {
  closeUserMenu,
  getUserMenuRequest,
  subscribeToUserMenu,
  type UserMenuPerson,
} from './useUserMenu';
import { resolveAction, type UserMenuAction } from './userMenuActions';

/** A slow card leaves View Details only (fail closed). */
export const CARD_TIMEOUT_MS = 8000;

export type UserMenuView = 'menu' | 'details' | 'confirm';

export interface UserMenuEngine {
  visible: boolean;
  view: UserMenuView;
  person: UserMenuPerson | null;
  actions: UserMenuAction[];
  confirming: UserMenuAction | null;
  busy: boolean;
  /** Message shown over the open sheet (card failed to load). */
  sheetMessage: string | null;
  /** Message shown after the sheet closed (action done or failed). */
  toast: string | null;
  showDetails: () => void;
  chooseAction: (action: UserMenuAction) => void;
  cancelConfirm: () => void;
  confirm: () => void;
  close: () => void;
  dismissSheetMessage: () => void;
  dismissToast: () => void;
}

export function useUserMenuEngine(): UserMenuEngine {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const { user } = useAuth();
  const viewerId = user?.id;
  const request = useSyncExternalStore(subscribeToUserMenu, getUserMenuRequest);

  const [view, setView] = useState<UserMenuView>('menu');
  const [card, setCard] = useState<UserCardOut | null>(null);
  const [confirming, setConfirming] = useState<UserMenuAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetMessage, setSheetMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const correlationRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const seq = request?.seq ?? null;
  const person = request?.person ?? null;
  const context = request?.context ?? null;

  useEffect(() => {
    setCard(null);
    setConfirming(null);
    setBusy(false);
    busyRef.current = false;
    setSheetMessage(null);
    correlationRef.current = null;
    if (!request) {
      return undefined;
    }
    setView(request.mode === 'menu' ? 'menu' : 'details');
    const { person: who, context: where, mode } = request;
    const fetchable =
      mode === 'menu' &&
      (where.type === 'group' || where.type === 'game') &&
      Boolean(where.id) &&
      Boolean(who.userId) &&
      who.userId !== viewerId;
    if (!fetchable) {
      return undefined;
    }

    let stale = false;
    withCorrelationId(async correlationId => {
      correlationRef.current = correlationId;
      const options = { correlationId, timeoutMs: CARD_TIMEOUT_MS };
      return where.type === 'group'
        ? getGroupMemberCard(where.id as string, who.userId as string, options)
        : getEventPlayerCard(where.id as string, who.userId as string, options);
    })
      .then(result => {
        if (!stale) {
          setCard(result);
        }
      })
      .catch(error => {
        if (stale) {
          return;
        }
        if (isNotFoundError(error)) {
          showAccessNotice();
          closeUserMenu();
          request.onChanged?.();
        } else {
          setSheetMessage(tRef.current('mob.user_menu.card_load_failed'));
        }
      });
    return () => {
      stale = true;
    };
    // A new request (seq) restarts the engine; viewerId is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  const actions: UserMenuAction[] =
    card && !card.is_self && context && (context.type === 'group' || context.type === 'game')
      ? card.allowed_actions
          .filter(item => item.requires_approval !== true)
          .map(item => resolveAction(item.key, context.type))
          .filter((action): action is UserMenuAction => action !== undefined)
      : [];

  const close = useCallback(() => closeUserMenu(), []);
  const showDetails = useCallback(() => setView('details'), []);
  const chooseAction = useCallback((action: UserMenuAction) => {
    setConfirming(action);
    setView('confirm');
  }, []);
  const cancelConfirm = useCallback(() => {
    setConfirming(null);
    setView('menu');
  }, []);

  const confirm = useCallback(() => {
    if (!request || !confirming || !request.person.userId || !request.context.id || busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const { person: who, context: where, onChanged } = request;
    const correlationId = correlationRef.current;
    const run = (id: string): Promise<unknown> =>
      confirming.run(where.id as string, who.userId as string, id);
    (correlationId ? run(correlationId) : withCorrelationId(run))
      .then(() => {
        closeUserMenu();
        setToast(tRef.current('mob.user_menu.action_done'));
        onChanged?.();
      })
      .catch(error => {
        closeUserMenu();
        if (isNotFoundError(error)) {
          showAccessNotice();
        } else {
          setToast(getApiErrorMessage(error, tRef.current('mob.user_menu.action_failed')));
        }
        onChanged?.();
      });
  }, [request, confirming]);

  const dismissSheetMessage = useCallback(() => setSheetMessage(null), []);
  const dismissToast = useCallback(() => setToast(null), []);

  return {
    visible: request !== null,
    view,
    person,
    actions,
    confirming,
    busy,
    sheetMessage,
    toast,
    showDetails,
    chooseAction,
    cancelConfirm,
    confirm,
    close,
    dismissSheetMessage,
    dismissToast,
  };
}
