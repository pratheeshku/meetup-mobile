/**
 * Contract of the user card endpoints (DES-MEETUP-ADDENDUM-user-details-menu AD-2):
 * `GET /groups/{group_id}/members/{user_id}/card` and
 * `GET /events/{event_id}/players/{user_id}/card`.
 *
 * Exactly these fields; nothing else is read from the response (UM-09). `allowed_actions` is the
 * server's decision (AD-3); the client never derives it.
 */
export interface UserCardAction {
  key: string;
  requires_approval: boolean;
}

export interface UserCardOut {
  user_id: string;
  display_name: string;
  nickname: string | null;
  photo_url: string | null;
  is_self: boolean;
  /** "owner" | "admin" | "member" | "organizer" | "player" | "waitlisted" | "invited" */
  relation: string;
  allowed_actions: UserCardAction[];
}
