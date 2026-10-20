/**
 * Action registry for the user details menu (DES-MEETUP-ADDENDUM-user-details-menu AD-2, AD-3,
 * AD-4): the closed set of keys the server may put in `allowed_actions`, each mapped to its label
 * keys, icon, tone and the existing `src/api` call it runs. A key that is not here, or that
 * belongs to another context, is ignored. Labels never decide which action shows; the server does.
 */
import type React from 'react';

import { removeEventParticipant } from '../api/events';
import { removeMember, transferGroupOwnership, updateMemberRole } from '../api/groups';
import {
  PersonMinusIcon,
  ShieldMinusIcon,
  ShieldPlusIcon,
} from '../components/icons/GroupViewIcons';
import { OwnerIcon } from '../components/icons/ActionIcons';
import type { LabelKey } from '../labels/fallbackLabels';

export type ActionContext = 'group' | 'game';

export interface UserMenuAction {
  key: string;
  context: ActionContext;
  labelKey: LabelKey;
  confirmBodyKey: LabelKey;
  tone: 'default' | 'destructive';
  Icon: React.ComponentType<{ size?: number; color: string }>;
  /** Runs the existing API call; `correlationId` is the one the card fetch used. */
  run: (contextId: string, userId: string, correlationId: string) => Promise<unknown>;
}

const ACTIONS: UserMenuAction[] = [
  {
    key: 'make_admin',
    context: 'group',
    labelKey: 'mob.user_menu.make_admin',
    confirmBodyKey: 'mob.user_menu.confirm_body_make_admin',
    tone: 'default',
    Icon: ShieldPlusIcon,
    run: (groupId, userId, correlationId) =>
      updateMemberRole(groupId, userId, 'admin', { correlationId }),
  },
  {
    key: 'remove_admin',
    context: 'group',
    labelKey: 'mob.user_menu.remove_admin',
    confirmBodyKey: 'mob.user_menu.confirm_body_remove_admin',
    tone: 'default',
    Icon: ShieldMinusIcon,
    run: (groupId, userId, correlationId) =>
      updateMemberRole(groupId, userId, 'member', { correlationId }),
  },
  {
    key: 'make_owner',
    context: 'group',
    labelKey: 'mob.user_menu.make_owner',
    confirmBodyKey: 'mob.user_menu.confirm_body_make_owner',
    tone: 'default',
    Icon: OwnerIcon,
    run: (groupId, userId, correlationId) =>
      transferGroupOwnership(groupId, userId, { correlationId }),
  },
  {
    key: 'remove_from_group',
    context: 'group',
    labelKey: 'mob.user_menu.remove_from_group',
    confirmBodyKey: 'mob.user_menu.confirm_body_remove_from_group',
    tone: 'destructive',
    Icon: PersonMinusIcon,
    run: (groupId, userId, correlationId) => removeMember(groupId, userId, { correlationId }),
  },
  {
    key: 'remove_player',
    context: 'game',
    labelKey: 'mob.user_menu.remove_player',
    confirmBodyKey: 'mob.user_menu.confirm_body_remove_player',
    tone: 'destructive',
    Icon: PersonMinusIcon,
    run: (eventId, userId, correlationId) =>
      removeEventParticipant(eventId, userId, { correlationId }),
  },
];

const BY_KEY = new Map(ACTIONS.map(action => [action.key, action]));

/** The registry entry for a server key in this context, or undefined (unknown: ignored). */
export function resolveAction(key: string, context: string): UserMenuAction | undefined {
  const action = BY_KEY.get(key);
  return action && action.context === context ? action : undefined;
}
