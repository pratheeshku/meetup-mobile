/**
 * User details menu contract (DES-MEETUP-ADDENDUM-user-details-menu.md AD-2).
 * `UserCardOut` is the response of the two card endpoints; nothing else is added to it (UM-09).
 */
export interface AllowedAction {
  /** One of the closed v1 set (`USER_ACTION_KEYS`); an unknown key is ignored by the client. */
  key: string;
  requires_approval: boolean;
}

export interface UserCardOut {
  user_id: string;
  display_name: string;
  nickname: string | null;
  photo_url: string | null;
  is_self: boolean;
  relation: string;
  allowed_actions: AllowedAction[];
}

/** Response or role badge a host row passes to the combined user pop-up (game-view-redesign AD-7). */
export interface UserBadge {
  /** Label-system text, already resolved by the host. */
  label: string;
  tone: 'accepted' | 'declined' | 'pending' | 'organizer' | 'neutral';
}

/** What a row already knows about a person: enough to show the pop-up identity with no request. */
export interface UserIdentity {
  /** `null` for a person with no linked user (tournament registration without a user id). */
  userId: string | null;
  displayName: string;
  /**
   * `string` or `null`: shown, or the "No nickname" label when empty.
   * `undefined`: the row does not carry a nickname at all, so the line is left out rather than
   * claiming there is none.
   */
  nickname?: string | null;
  photoUrl?: string | null;
  /** Response/role badge where the host list knows it (Accepted, Declined, Pending, Organizer). */
  badge?: UserBadge | null;
}

export type UserMenuContextType = 'group' | 'game' | 'tournament' | 'none';

export interface UserMenuContext {
  type: UserMenuContextType;
  id?: string;
}

/** The v1 action keys (AD-2, AD-3). */
export const USER_ACTION_KEYS = [
  'make_admin',
  'remove_admin',
  'make_owner',
  'remove_from_group',
  'remove_player',
] as const;
export type UserActionKey = (typeof USER_ACTION_KEYS)[number];
