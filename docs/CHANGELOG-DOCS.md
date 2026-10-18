# Document amendment history
One section per document. Version and amendment narrative belongs here; document headers keep only Version and Status. Only the architect edits this file.

## DES-MEETUP-MOBILE.md and addenda
Not yet migrated. Amendment narrative still sits in each document's header and review log and moves here in a separate architect edit.

## DES-MEETUP-ADDENDUM-invitation-response.md
- v0.1 (2026-10-18): first draft.
- v1.0 (2026-10-18): approved by the owner. Mobile scope: task ia-clients, after ia-backend is deployed and OI-2 (no board for the outcome message) is resolved.

## DES-MEETUP-ADDENDUM-access-consistency.md
- v1.0 (2026-10-18): approved by the owner. Copy of the backend repo's document; the backend copy is the one the owner updates.
- v1.1 (2026-10-18): no CHECK constraints on the new audit table (owner rule: no DB-side validation). Copy of the backend repo's document.
- v1.3 (2026-10-18): group deletion guard and group invitations need membership (backend/web scope; mobile only shows the server's 409 message on delete group). Copy synced from ~/meetup.
- v1.2 (2026-10-18): owner decisions after ac-p1-verify. Copy of the backend repo's document.
