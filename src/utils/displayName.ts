/**
 * The name used to address the signed-in user ("Ready to play, <name>?",
 * the Profile title). `display_name` is the user-editable name; `nickname`
 * is the unique, read-only handle and is only a fallback for when
 * `display_name` is absent or blank (e.g. an auth response that predates it).
 *
 * Only for addressing the *current* user. Other people's names in lists
 * (organiser, owner, members) are identity display and keep using nickname.
 */
export function getDisplayName(
  user: { display_name?: string | null; nickname?: string | null } | null | undefined,
): string {
  return user?.display_name?.trim() || user?.nickname?.trim() || '';
}
