/**
 * State and behaviour of the user details menu (DES-MEETUP-ADDENDUM-user-details-menu.md AD-4,
 * AD-5, AD-7). One hook per host screen; `UserPressable` opens it, `UserMenuSheet` renders it.
 *
 * - View Details is available at once from the row identity, with no request.
 * - The card is fetched on EVERY open of the menu (never cached), only for context `group` or
 *   `game`, a person with a user id, and not the viewer. Actions appear only after a successful
 *   fetch and only for keys in the registry below (unknown keys are ignored). A failed or slow
 *   fetch leaves View Details only (fail closed).
 * - The card fetch and the action it leads to share one correlation id.
 * - A 404 from the card or from an action closes the menu, shows the existing "no longer
 *   available" notice and asks the host to refetch. Any other refusal shows the server's message
 *   and asks the host to refetch.
 * - Rights are never computed here: the list of actions is exactly what the server returned.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { generateCorrelationId } from '../api/correlationId';
import { removeEventPlayer, getEventPlayerCard } from '../api/events';
import {
  getGroupMemberCard,
  removeMember,
  transferGroupOwnership,
  updateMemberRole,
} from '../api/groups';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import { showAccessNotice } from '../navigation/accessNotice';
import { getApiErrorMessage, isNotFoundError } from '../utils/apiError';
import {
  USER_ACTION_KEYS,
  type UserActionKey,
  type UserCardOut,
  type UserIdentity,
  type UserMenuContext,
} from '../types/userMenu';

/** A card that has not answered by now counts as failed (fail closed). */
export const CARD_TIMEOUT_MS = 10000;

export type UserMenuMode = 'closed' | 'menu' | 'details' | 'confirm';
export type CardStatus = 'none' | 'loading' | 'ready' | 'failed';
export type ActionIconKey = 'shield_plus' | 'shield_minus' | 'owner' | 'person_minus';

interface ActionDef {
  labelKey: LabelKey;
  confirmBodyKey: LabelKey;
  icon: ActionIconKey;
  tone: 'default' | 'destructive';
  /** Asks first. Destructive actions always do; "Make owner" keeps the confirmation it had. */
  confirm: boolean;
  context: 'group' | 'game';
  run: (contextId: string, userId: string, correlationId: string) => Promise<unknown>;
}

/** Action key -> label key, icon, tone, handler (existing `src/api` functions). */
const REGISTRY: Record<UserActionKey, ActionDef> = {
  make_admin: {
    labelKey: 'mob.user_menu.make_admin',
    confirmBodyKey: 'mob.user_menu.confirm_body_make_admin',
    icon: 'shield_plus',
    tone: 'default',
    confirm: false,
    context: 'group',
    run: (id, userId, correlationId) => updateMemberRole(id, userId, 'admin', { correlationId }),
  },
  remove_admin: {
    labelKey: 'mob.user_menu.remove_admin',
    confirmBodyKey: 'mob.user_menu.confirm_body_remove_admin',
    icon: 'shield_minus',
    tone: 'default',
    confirm: false,
    context: 'group',
    run: (id, userId, correlationId) => updateMemberRole(id, userId, 'member', { correlationId }),
  },
  make_owner: {
    labelKey: 'mob.user_menu.make_owner',
    confirmBodyKey: 'mob.user_menu.confirm_body_make_owner',
    icon: 'owner',
    tone: 'default',
    confirm: true,
    context: 'group',
    run: (id, userId, correlationId) => transferGroupOwnership(id, userId, { correlationId }),
  },
  remove_from_group: {
    labelKey: 'mob.user_menu.remove_from_group',
    confirmBodyKey: 'mob.user_menu.confirm_body_remove_from_group',
    icon: 'person_minus',
    tone: 'destructive',
    confirm: true,
    context: 'group',
    run: (id, userId, correlationId) => removeMember(id, userId, { correlationId }),
  },
  remove_player: {
    labelKey: 'mob.user_menu.remove_player',
    confirmBodyKey: 'mob.user_menu.confirm_body_remove_player',
    icon: 'person_minus',
    tone: 'destructive',
    confirm: true,
    context: 'game',
    run: (id, userId, correlationId) => removeEventPlayer(id, userId, { correlationId }),
  },
};

export interface MenuAction {
  key: UserActionKey;
  label: string;
  icon: ActionIconKey;
  tone: 'default' | 'destructive';
}

export interface UseUserMenuOptions {
  context: UserMenuContext;
  /** The signed-in user; the viewer's own avatar gets View Details only. */
  currentUserId?: string | null;
  /** Called after an action ran (done or refused) or after a 404, so the host refetches. */
  onChanged?: () => void;
}

export interface UserMenuApi {
  mode: UserMenuMode;
  isOpen: boolean;
  person: UserIdentity | null;
  card: UserCardOut | null;
  cardStatus: CardStatus;
  actions: MenuAction[];
  confirmAction: MenuAction | null;
  confirmBody: string;
  busy: boolean;
  notice: string | null;
  clearNotice: () => void;
  /** Tap: View Details from the row identity, no request. */
  openDetails: (person: UserIdentity) => void;
  /** Long-press: the menu (View Details first, then the server's actions). */
  openMenu: (person: UserIdentity) => void;
  showDetails: () => void;
  runAction: (key: UserActionKey) => void;
  confirmYes: () => void;
  confirmCancel: () => void;
  close: () => void;
}

export function useUserMenu({
  context,
  currentUserId,
  onChanged,
}: UseUserMenuOptions): UserMenuApi {
  const t = useT();
  const [mode, setMode] = useState<UserMenuMode>('closed');
  const [person, setPerson] = useState<UserIdentity | null>(null);
  const [card, setCard] = useState<UserCardOut | null>(null);
  const [cardStatus, setCardStatus] = useState<CardStatus>('none');
  const [confirmKey, setConfirmKey] = useState<UserActionKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const contextRef = useRef(context);
  contextRef.current = context;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const tRef = useRef(t);
  tRef.current = t;

  // Latest open wins: a late card answer for an earlier open is dropped.
  const openSeq = useRef(0);
  // One correlation id per logical action: the card fetch and the action it leads to share it.
  const correlationRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const reset = useCallback((): void => {
    openSeq.current += 1;
    setMode('closed');
    setPerson(null);
    setCard(null);
    setCardStatus('none');
    setConfirmKey(null);
    setBusy(false);
    busyRef.current = false;
    correlationRef.current = null;
  }, []);

  const close = reset;

  const openDetails = useCallback((next: UserIdentity): void => {
    openSeq.current += 1;
    setPerson(next);
    setCard(null);
    setCardStatus('none');
    setConfirmKey(null);
    setMode('details');
  }, []);

  const openMenu = useCallback(
    (next: UserIdentity): void => {
      const seq = ++openSeq.current;
      setPerson(next);
      setCard(null);
      setConfirmKey(null);
      setMode('menu');
      correlationRef.current = null;

      const ctx = contextRef.current;
      const canFetch =
        (ctx.type === 'group' || ctx.type === 'game') &&
        Boolean(ctx.id) &&
        Boolean(next.userId) &&
        next.userId !== currentUserIdRef.current;
      if (!canFetch) {
        setCardStatus('none');
        return;
      }

      setCardStatus('loading');
      const correlationId = generateCorrelationId();
      correlationRef.current = correlationId;
      const contextId = ctx.id as string;
      const userId = next.userId as string;
      const request =
        ctx.type === 'group'
          ? getGroupMemberCard(contextId, userId, { correlationId })
          : getEventPlayerCard(contextId, userId, { correlationId });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('card timeout')), CARD_TIMEOUT_MS);
      });
      Promise.race([request, timeout]).then(
        result => {
          clearTimeout(timer);
          if (seq !== openSeq.current) {
            return;
          }
          setCard(result);
          setCardStatus('ready');
        },
        error => {
          clearTimeout(timer);
          if (seq !== openSeq.current) {
            return;
          }
          if (isNotFoundError(error)) {
            reset();
            showAccessNotice();
            onChangedRef.current?.();
            return;
          }
          setCardStatus('failed');
          setNotice(tRef.current('mob.user_menu.card_load_failed'));
        },
      );
    },
    [reset],
  );

  const showDetails = useCallback((): void => {
    setConfirmKey(null);
    setMode('details');
  }, []);

  // The server decides which actions exist; the registry only maps keys. Unknown keys, keys that do
  // not belong to this context, and anything that asks for approval (not a v1 action) are dropped.
  const actions = useMemo<MenuAction[]>(() => {
    if (cardStatus !== 'ready' || !card || card.is_self) {
      return [];
    }
    if (card.user_id === currentUserId) {
      return [];
    }
    const out: MenuAction[] = [];
    for (const item of card.allowed_actions ?? []) {
      const key = item.key as UserActionKey;
      if (!(USER_ACTION_KEYS as readonly string[]).includes(item.key) || item.requires_approval) {
        continue;
      }
      const def = REGISTRY[key];
      if (def.context !== context.type) {
        continue;
      }
      out.push({ key, label: t(def.labelKey), icon: def.icon, tone: def.tone });
    }
    return out;
  }, [card, cardStatus, context.type, currentUserId, t]);

  const execute = useCallback(
    async (key: UserActionKey): Promise<void> => {
      const def = REGISTRY[key];
      const ctx = contextRef.current;
      if (busyRef.current || !def || !ctx.id) {
        return;
      }
      const userId = card?.user_id ?? person?.userId;
      if (!userId) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      const correlationId = correlationRef.current ?? generateCorrelationId();
      try {
        await def.run(ctx.id, userId, correlationId);
        reset();
        setNotice(tRef.current('mob.user_menu.action_done'));
        onChangedRef.current?.();
      } catch (error) {
        reset();
        if (isNotFoundError(error)) {
          showAccessNotice();
        } else {
          setNotice(getApiErrorMessage(error, tRef.current('mob.user_menu.action_failed')));
        }
        onChangedRef.current?.();
      }
    },
    [card, person, reset],
  );

  const runAction = useCallback(
    (key: UserActionKey): void => {
      const def = REGISTRY[key];
      if (!def) {
        return;
      }
      if (def.confirm) {
        setConfirmKey(key);
        setMode('confirm');
        return;
      }
      execute(key);
    },
    [execute],
  );

  const confirmYes = useCallback((): void => {
    if (confirmKey) {
      execute(confirmKey);
    }
  }, [confirmKey, execute]);

  const confirmCancel = useCallback((): void => {
    setConfirmKey(null);
    setMode('menu');
  }, []);

  const clearNotice = useCallback((): void => setNotice(null), []);

  const confirmAction = confirmKey ? actions.find(action => action.key === confirmKey) ?? null : null;
  const name = card?.display_name ?? person?.displayName ?? '';
  const confirmBody = confirmKey ? t(REGISTRY[confirmKey].confirmBodyKey, { name }) : '';

  return {
    mode,
    isOpen: mode !== 'closed',
    person,
    card,
    cardStatus,
    actions,
    confirmAction,
    confirmBody,
    busy,
    notice,
    clearNotice,
    openDetails,
    openMenu,
    showDetails,
    runAction,
    confirmYes,
    confirmCancel,
    close,
  };
}
