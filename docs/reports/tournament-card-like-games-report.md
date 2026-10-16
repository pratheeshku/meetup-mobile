# tournament-card-like-games report — BLOCKED (not started)

Per the brief ("If a field you need is missing, STOP and list it"), no code was written for this task.

## Fields the card needs that the tournaments **list** does not supply
`getTournaments()` (`src/api/tournaments.ts`) calls `GET /tournaments` and maps each item with `mapTournamentApiItem`. The raw list item type contains only: `id, organizer_id, sport, title, name, description, format, capacity, registration_closes_at, starts_at, status, created_at`. The mapper then hard-codes:

| Card needs | What the list gives today |
|---|---|
| Registered count ("x / max") | `participant_count: 0` hard-coded; no count in the raw item. Only `capacity` (max) is real. |
| Registration status badge (Not registered / Registered / Withdrawn) | `current_user_registration_status: 'none'` hard-coded; no such field in the raw item. Every row would read "Not Registered". |
| Venue (map pin row) | No venue field in the raw list item (`Tournament.venue_name`/`venue_label`/`venue_snapshot` exist on the type but are never populated by the list mapper). |
| Registration dates | `registration_closes_at` is in the raw item but dropped by the mapper (only collapsed into `registration_open`). Surfacing it needs no new endpoint. |
| Avatars | No participant photos in the list item (omitted, as the brief allows). |
| Organiser flag | `is_organiser: false` hard-coded. |

Rendering the card from this data would show **"0/8 registered" and "Not Registered" for every tournament**, which is wrong, not just incomplete. I did not want to ship that.

## What I need from you
One of:
1. Confirm the backend `GET /tournaments` list item (OpenAPI) already returns `participant_count`, the caller's registration status and venue fields, and I will extend `TournamentApiItem`/mapper to read them (no new endpoint, no per-row calls); or
2. Add those fields to the list response on the backend first (meetup repo, not in this session's scope); or
3. Approve a reduced card (date tile, title, sport/format, start date, max capacity, status badge from `status`/`registration_open`) with no count, venue or per-user registration badge.

Everything else in the brief is clear and unchanged: add `UnifiedTournamentCard` next to `UnifiedGameCard` reusing `UnifiedCard`, map badges onto the game-badge styling, keep tap → TournamentDetail, pull-to-refresh, empty/loading/error states and the `refreshKey` path, and add the four tests.

Available UnifiedCard reuse points confirmed: `UnifiedCard`, `DateBlock`, `ClockIcon`/`MapPinIcon`, status pill styles, `mob.home.view_game` (a "View tournament" label key does not exist yet; one new key would be needed).
