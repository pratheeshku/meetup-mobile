/**
 * Resolves a backend `avatar_storage_key` to a full, displayable URL.
 *
 * DES-MEETUP-ADDENDUM-profile-photo §5, §10.1 — this is the scheme that was
 * missing when the 2026-09-18 contract audit flagged `avatar_url` as BLOCKED
 * ("no documented scheme exists anywhere in the design for turning a storage
 * key into a displayable URL"). §5 of the addendum specifies:
 *   `{configured_bucket_base_url}/{avatar_storage_key}`
 *
 * Bucket base URL comes from `ENV.AVATAR_BUCKET_BASE_URL` (P1 — config-driven,
 * never hardcoded). Lives in its own util (not inlined in `profile.ts`) so it's
 * ready to reuse for EventCard/EventDetailScreen if/when they adopt real photos
 * (P3), without this addendum being the decision that expands scope there.
 */
import { ENV } from '../../config/env';

/**
 * Returns the full display URL for an avatar storage key, or `null` when
 * there is no photo (the caller should fall back to a placeholder).
 *
 * Object keys are server-generated (§6, P9) — the client never constructs
 * or guesses a key; it only resolves one it received from the backend.
 */
export function getAvatarUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) {
    return null;
  }
  return `${ENV.AVATAR_BUCKET_BASE_URL}/${storageKey}`;
}
