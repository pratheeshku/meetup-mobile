# Blocked note — DES-MEETUP-FEEDBACK-001 v1.0, mobile integration check

Not a stop: the mobile code is built against the design contract. These items
need confirming against the deployed backend before release. Nothing is mocked
in production code.

## B1. Suggested-members endpoint not confirmed deployed (task 4)

- Design C4 gives the contract (group ID in; out per card: user ID, display
  name, nickname, image URL; max 5) but **not** the HTTP path or JSON field
  names. Built as `GET /groups/{group_id}/suggested-members` returning a bare
  array of `{ user_id, display_name, nickname, image_url }`
  (`src/api/groups.ts` → `getSuggestedMembers`). Path and field names are
  assumptions to verify.
- A search of the local backend checkout (`~/Developer/meetup`) found no
  suggestions route.

## B2. Add-member response shape (task 4)

- Design: the existing add call's response "carries the next candidate".
  The field name is not specified. Built to read `next_candidate`
  (`{ user_id, display_name, nickname, image_url }` or null/absent when the
  pool is empty) from the existing `POST /groups/{id}/invite` response
  (`inviteMember` in `src/api/groups.ts`). If the field differs, the list
  shrinks instead of backfilling — verify.

## B3. Share URL value not provided (task 5)

- `config/appConfig.json` → `shareUrl` is the backend store-redirect URL. The
  design does not give its value or path, so it is committed **empty**. While
  empty, the share actions show "Sharing is not available right now." instead
  of sharing a made-up link. Set it to the deployed redirect URL before release.

## Verify at integration

1. Suggestions: ≤5 cards, non-admin denied, tap adds and backfills, empty pool
   shrinks the list, double tap sends one add.
2. Share: Android and iOS recipients land on their store via the one URL.
