/**
 * In-memory link state (deep-links AD-6, AD-7). Everything here lives in module memory only:
 * never AsyncStorage, Keychain, navigation params, navigation state persistence, logs or analytics.
 * The reset token and the group token are claims; they stay in this file until used or dropped.
 */
import { isUuid } from './parseLink';

/** What to open once the person is signed in (or, for game and group invitation, what the signed-out landing shows). */
export type PendingTarget =
  | { kind: 'game'; eventId: string; ref?: string; invite?: string }
  | { kind: 'tournament'; tournamentId: string; invite?: string }
  | { kind: 'group_invite'; token: string }
  /** Set after account creation joined the person to a group (`joined_group_id`). */
  | { kind: 'group'; groupId: string };

export interface InvitationFields {
  invitation_token?: string;
  ref?: string;
  event_id?: string;
  invite?: string;
}

/** Where the Sign In stack starts after a signed-in device was signed out from the reset screen. */
export type AuthLanding = 'reset_done' | 'forgot';

type Listener = () => void;

let pending: PendingTarget | null = null;
let resetToken: string | null = null;
let authLanding: AuthLanding | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(listener => listener());
}

export function subscribeToLinkStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPendingTarget(target: PendingTarget): void {
  pending = target;
  emit();
}

export function peekPendingTarget(): PendingTarget | null {
  return pending;
}

/** Returns the pending target and forgets it. */
export function takePendingTarget(): PendingTarget | null {
  const current = pending;
  if (current) {
    pending = null;
    emit();
  }
  return current;
}

export function clearPendingTarget(): void {
  takePendingTarget();
}

export function setResetToken(token: string): void {
  resetToken = token;
  emit();
}

export function getResetToken(): string | null {
  return resetToken;
}

export function clearResetToken(): void {
  if (resetToken !== null) {
    resetToken = null;
    emit();
  }
}

/**
 * A signed-in device that finishes (or gives up on) a reset is signed out; the Sign In stack it lands
 * on starts at Login with the confirmation (`reset_done`) or at Forgot password (`forgot`), once.
 */
export function setAuthLanding(landing: AuthLanding): void {
  authLanding = landing;
}

export function consumeAuthLanding(): AuthLanding | null {
  const landing = authLanding;
  authLanding = null;
  return landing;
}

/**
 * The invitation fields a link supplied, for account-creation requests only (sign-up and the social
 * callback). All optional UUIDs; an empty object when no link supplied any (the request is then
 * exactly as before). Never sent at ordinary sign-in.
 */
export function getInvitationFields(): InvitationFields {
  const fields: InvitationFields = {};
  if (!pending) {
    return fields;
  }
  if (pending.kind === 'game') {
    fields.event_id = pending.eventId;
    if (pending.ref) {
      fields.ref = pending.ref;
    }
    if (pending.invite) {
      fields.invite = pending.invite;
    }
  } else if (pending.kind === 'tournament') {
    if (pending.invite) {
      fields.invite = pending.invite;
    }
  } else if (pending.kind === 'group_invite') {
    fields.invitation_token = pending.token;
  }
  return fields;
}

/** Account creation returned `joined_group_id`: after sign-in open that group. A non-UUID value is ignored. */
export function noteJoinedGroup(groupId: string | null | undefined): void {
  if (isUuid(groupId)) {
    setPendingTarget({ kind: 'group', groupId });
  }
}

/** Test helper. */
export function _resetLinkStoreForTesting(): void {
  pending = null;
  resetToken = null;
  authLanding = null;
  listeners.clear();
}
