/**
 * In-memory summary of a group that was just created (step 1).
 * Step 2 (invite) reads it for the completion screen. Not persisted,
 * not logged. Abandoning step 2 does not delete the group — it already
 * exists on the server.
 */
export interface GroupCreateDraft {
  groupId: string;
  name: string;
  description: string;
  logoAdded: boolean;
}

let draft: GroupCreateDraft | null = null;

export function rememberGroupCreateDraft(next: GroupCreateDraft): void {
  draft = next;
}

export function readGroupCreateDraft(groupId: string): GroupCreateDraft | null {
  if (!draft || draft.groupId !== groupId) {
    return null;
  }
  return draft;
}

export function clearGroupCreateDraft(): void {
  draft = null;
}
