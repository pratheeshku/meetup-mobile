# DES-MEETUP-ADDENDUM-VENUE-CATALOGUE

**Doc ID:** DES-MEETUP-ADDENDUM-VENUE-CATALOGUE
**Version:** v1.0 (amends v0.3; review rounds 1–3: see §17)
**Status:** APPROVED (owner, 2026-10-15). Non-blocking open items in §14 (OI-1–OI-11). OI-9 is the Phase 1 gate; OI-2 gates photo promotion only.
**Owner:** Pratheesh
**Date:** 2026-10-15
**Scale Tier:** T1
**Baseline:** `DES-MEETUP.md` v1.75 (not in the Project; read from repo in Phase 1). Design-only addendum, same pattern as `DES-MEETUP-ADDENDUM-tournament-lifecycle.md` (v1.1). Does not edit the baseline.
**Governing files (read in full before drafting):** `Enterprise_Design_Principles.md` v1.1 (P1–P17), `design-best-practices.md` v1.0 (BP-01–BP-13).
**Visual source:** Design canvas https://claude.ai/artifact/SRavBx8jwnK8kK1QjVovnM (v51). Updated boards: `Game3When`, `EditGame2`, `TournSched`, `TournSchedErr`, `TournSchedWarn`, `FXEdit`, `FXEditCourt`, `FXEditPlayer`, `FXEditRest`, `FXEditRound`, `FXEditWindow`, `WebCreateBasics`, `GameDetail`.

**Process notes (flagged, not silent):**
1. No formal `REQ-MEETUP` addendum exists. Requirements were elicited in conversation (2026-10-15) and are restated in §1 as `VC-01…VC-14`. Same departure as the lifecycle addendum (its D-5). §1 is approved with this document (owner, 2026-10-15). Routing it into `REQ-MEETUP.md` remains optional.
2. **BP-01 limit.** The baseline DDL for games and sports was not available when this was written. Every reference to an existing table or column is marked **(verify)** and is a Phase 1 gate (OI-9). New table names are proposals.
3. Group selection (multi-select, cap 20) was reviewed during this work. It is already specified (lifecycle TL-11, Part A) and drawn on the canvas. Out of scope here, unchanged.

---

## Plain-language summary

When an organizer creates or edits a game or tournament, they pick the venue from a list instead of typing it. The list is filtered to the sport they chose. Most entries come from Sport Singapore's public open datasets (sport facilities and school facilities), loaded by a daily job. If the venue is not listed, the organizer picks **Others** and enters a name and postal code. The app looks up the address and map pin.

There is no live ActiveSG integration. ActiveSG has no public API, and booking sits behind Singpass. This design uses only the official open data. It shows **no availability and no booking**.

The game or tournament keeps its own **copy** of the venue. Later changes to the catalogue never alter existing games. If a venue disappears from the source, it is quietly retired from the picker, and existing games are untouched.

Organizers can add photos to their own game or tournament. Platform admins keep a shared set of venue photos, and can promote a good organizer photo into it. Promotion is switched off until the privacy policy and T&C are updated.

A venue feed is built per provider (one extractor each) and written to a standard file. One shared loader updates the database. A new provider later means one new extractor.

---

## 1. Requirements baseline (from 2026-10-15 elicitation; approved with this document)

| ID | Requirement |
|---|---|
| VC-01 | A venue is required to create a game or tournament. It is chosen from the catalogue or entered as **Others**. |
| VC-02 | The catalogue is fed only from official open datasets. No booking, availability, scraping behind login, or Singpass use. |
| VC-03 | A catalogue venue carries: name, block, street, postal code, latitude/longitude. School venues also carry facility types, per-facility operating hours and an information link, as the dataset provides them. |
| VC-04 | **Others** captures: name, postal code (the app resolves address and map pin), facility types (multi-select), optional operating hours, optional information link. Its source is `user`. |
| VC-05 | The venue list is filtered by the sport chosen for the game or tournament. The server applies the filter. A venue not tagged for the sport is not offered. **Others** is always offered. |
| VC-06 | Sport tags are maintained by platform admins and can be bulk-loaded from an `.xlsx`. |
| VC-07 | A daily job per provider extracts to a standard file. A separate shared job loads the database from that file. Adding a provider must not change the loader. |
| VC-08 | The provider is the source of truth for its venues. A venue missing from the source is retired automatically, after the safeguards in AD-5. Retiring is not deleting. |
| VC-09 | A game or tournament takes a one-time **copy** of the chosen venue. There is no linkage to later feed changes. The organizer updates the venue themselves, by choosing again. No notification is sent on feed change. |
| VC-10 | Venue details have three layers: synced catalogue fields (read-only), shared admin details and images, organizer-scoped details (shown only in that organizer's own game or tournament). |
| VC-11 | Court count remains organizer-entered. The catalogue does not supply it (lifecycle AD-9 unchanged). |
| VC-12 | Admins curate shared venue images. An admin may promote an organizer's image into the shared set. Promotion copies the image, is audited, and is switched off until privacy policy and T&C are updated. |
| VC-13 | A promoted image stays if the uploader leaves. No personal attribution is shown. |
| VC-14 | Existing games and tournaments keep working. Nothing is migrated destructively (P14). |

---

## 2. Scope & Constraints

**In scope:** backend (`~/meetup`): schema additions, loader, extractors, endpoints, admin endpoints, config, jobs. Web (`frontend/`) and mobile (`~/Developer/meetup-mobile`) UI for the picker, **Others** form and photo display, from separate build briefs.

**Out of scope:** availability, booking, pricing, ActiveSG scraping, venue reviews, per-court catalogue, auto-merge of duplicate venues across providers, a favourite-venue feature, a venue-owner portal.

**Constraints**
- Migrations are written, never executed by agents. The human runs them (`CLAUDE.md`).
- Additive only (P14). No RLS scripts. Authorisation lives in the app layer (P15).
- Zero sibling imports between modules is enforced.
- Tier T1: one Postgres, one api process, one worker process (BP-12).
- Data sources: SportSG Sport Facilities (point GeoJSON; annual update, last 13 Nov 2025) and DUS school facilities (last updated 6 Jun 2024), both on data.gov.sg under the Singapore Open Data Licence. OneMap API for postal-code resolution (token required).
- **Reality of the data:** neither dataset has a stable venue ID, court counts, or (for SportSG) facility type or hours. The info and booking links are generic, not per venue.

---

## 3. Architecture Decisions

**AD-1: New `venues` module. No new service.** Catalogue, loader, tags and images live in `venues/`. Feed extractors live in `jobs/venue_extractors/`. Games and tournaments call the module only through its interface. Rejected: a separate venue microservice (T1, BP-12).

**AD-2: Open data only. No ActiveSG scraping.** Rejected: scraping MyActiveSG+ or any page behind login (terms of use, Computer Misuse Act s3, PDPA exposure). Rejected: scraping public ActiveSG pages (no ToS clause verified, brittle, no gain over the open data). The UI must not claim availability or deep-link to a specific booking, because the datasets only hold generic links.

**AD-3: One extractor per provider, one shared loader, a file contract between them.**
- Extractor output per run: `venues.csv` (or JSONL) plus `manifest.json` with `provider`, `run_id`, `schema_version`, `row_count`, `sha256`, `source_updated_at`.
- The file schema is versioned (`schema_version`, BP-08: independent of the DB schema version). Columns: `provider_venue_key, name, block, street, postal_code, lat, lng, facilities, operating_hours, info_url, booking_url`.
- `provider_venue_key` is defined by each extractor and stated in its manifest. For the two launch extractors it is `<provider>:<postal_code>:<normalised_name>`, because the datasets have no stable ID.
- **Uniqueness is the extractor's job (v0.2).** An extractor must emit unique keys. If two source rows collide on the base key, the extractor appends a disambiguator in this order: a facility-type slug when the source distinguishes the rows, otherwise a short hash of the rounded coordinates. It records the collision count in the manifest. The loader still rejects a file with duplicate keys (AD-4 step 3); it never merges or overwrites. Phase 2 must run both extractors on the real files and record the actual collision count (BP-01). The DUS record layout I read has one row per school with facilities as text, so collisions there are expected to be rare; this is unverified against the full file.
- The loader never knows provider internals. It reads the manifest and file only.
- Rejected: one combined job (adding a provider means editing the loader, and one provider's failure blocks another).

**AD-4: Loader behaviour (P5, P9).**
1. Take a per-provider advisory lock `pg_advisory_xact_lock(hashtextextended('vfeed:'||provider,0))`. A second concurrent run for the same provider exits as `skipped`.
2. Verify `sha256`, `row_count`, `schema_version`. Any mismatch → run `failed`, no data changed.
3. Validate every row against the provider config: required fields, postal code is 6 digits, lat/lng inside the configured Singapore bounding box, name length, unique `provider_venue_key`, URLs on `http(s)` only. Invalid rows are counted. If invalid rows exceed the provider's bound, the whole run is `failed`.
4. Diff against `venues` by `(provider, provider_venue_key)`. Insert new. Update **synced fields only**. Mark unchanged.
5. Write one `venue_feed_runs` row with counts. Idempotency key is `(provider, run_id)`; a re-delivered file is a no-op.
- Admin-owned data (sport tags, shared images, admin details) is never touched by the loader.
- Rejected: truncate-and-reload (would orphan tags and images).

**AD-5: Retirement is automatic, delayed and guarded (VC-08).**
- A venue absent from a **successful** run increments `missing_runs`. When it reaches `meetup.venue.feed.missing_runs_before_retire` (default 2) the venue becomes `retired`. It reappears in a later run → back to `active`, counter reset.
- **Rename detection (tightened in v0.2):** a postal code is not a venue identity, since one complex can host several facilities. A rename is accepted only when all three hold: (1) the missing key and the new key share the postal code; (2) at that postal code in this run, exactly **one** key went missing and exactly **one** key is new (a 1:1 swap); (3) the normalised-name similarity is at least `rename_min_similarity` (default 0.80). Then the row keeps its `id`, tags and images and takes the new key and name. Anything else (several missing or new at that postal code, or low similarity) is treated as retire plus insert. The failure mode is chosen deliberately: a missed rename costs an admin a re-tag; a false rename would hand one facility's tags and photos to another.
- **Anomaly guard (P12):** if a run would retire more than `max_retire_fraction` of active venues for that provider, or the file has fewer than `min_row_fraction` of the previous active count, the run is `rejected_anomaly`. Nothing changes. Admins are notified. An admin may release the run explicitly (audited in `admin_action_log`).
- Retired venues are hidden from the picker and from search. They are never hard-deleted by the loader.
- Admins get a notification listing venues retired in a run. For each retired venue it shows whether it had sport tags or shared images, and lists any new venues from the same run at the same postal code as likely replacements (v0.3), so a missed rename is easy to fix by hand.
- Rejected: immediate removal on first absence (a malformed feed would silently empty the picker).

**AD-6: Copy-on-select, no linkage (VC-09).**
- A game or tournament stores `venue_snapshot JSONB` (name, block, street, postal code, lat/lng, source, facility types, hours, info URL, captured at, `schema_version`). All display and logic read the snapshot. This also satisfies P6.
- `venue_id UUID NULL` is kept for one purpose only: fetching shared admin images for display. If the row is retired the images still show.
- The loader never writes to games or tournaments. A change at the source is invisible to an existing game until the organizer re-picks. The one system write to a snapshot after creation is the geocode completion in AD-8, which fills empty fields only.
- Court count is separate and organizer-entered (VC-11).
- Rejected: foreign-key linkage with cascading updates (breaks past-game history and was ruled out by the owner).

**AD-7: Sport filtering is server-side, tag-based (VC-05, VC-06).**
- `venue_sports(venue_id, sport_id)` is maintained by admins. `.xlsx` bulk import follows the AD-17 discipline from the lifecycle addendum (reject formulas, macros and external links; values-only read; size, row and time limits; all-or-nothing). The parser is shared code (P3).
- `GET /venues?sport_id=` returns only tagged venues. Creating or editing a game or tournament with a `venue_id` that is not tagged for its sport returns 422. Client filtering is UX only (P9).
- **Others** always passes the sport check.
- The catalogue stays off (`meetup.venue.catalogue.enabled = false`) until tags are seeded. Until then the existing free-text venue flow runs unchanged.
- Rejected: inferring sport from facility text (DUS text is free-form; SportSG has none).

**AD-8: Others venues (VC-04).**
- Organizer enters name and a 6-digit postal code. The server calls OneMap to resolve the address and coordinates. The client never sets coordinates for **Others**, and cannot drag the pin for a catalogue venue.
- Stored only in the game's or tournament's `venue_snapshot` with `source = 'user'`. **Others** venues are never added to the shared catalogue.
- OneMap sits behind a timeout, one retry on 5xx, and a circuit breaker (P7).
- **OneMap outage does not block the save (v0.2).** The postal code is validated as exactly 6 digits. If OneMap is unavailable, the snapshot is saved with name and postal code, `lat`/`lng` null and `geocoding_status = 'pending'`. The UI shows name and postal code with no pin. The existing worker loop picks up pending rows (partial expression index on `venue_snapshot->>'geocoding_status'`), retries with backoff, and on success writes the address and coordinates and sets `geocoded_at`. This is the **only** system write to a snapshot after creation, it applies only to `source = 'user'` rows, and it only fills the empty fields. **Write semantics (v0.3):** one atomic compare-and-set statement per row: update the snapshot only `WHERE id = ? AND venue_snapshot->>'geocoding_status' = 'pending' AND venue_snapshot->>'postal_code' = <the postal code that was looked up>`, merging only `lat`, `lng`, `address`, `geocoded_at`, `geocoding_status`. If the organizer changed the venue meanwhile, the snapshot is no longer pending for that postal code, the predicate fails, and nothing is overwritten. No row lock is held across the OneMap call. **Module boundary:** the geocode pass lives in `venues/` but writes only through a narrow function exposed by the games and tournaments modules (`apply_venue_geocode`), the same interface pattern used for groups; no sibling imports. Rejected: a separate `venue_pending_geocodes` table that the game display joins at read time (two sources of truth for one address, a read-time join on every game view, and the same cross-module link). The decision inputs the organizer chose (name, postal code) are never altered, so P6 holds. Rows still pending after `geocode_give_up_hours` stay as postal-code-only and raise an alert. Rejected: a separate queue service or table (BP-12).
- **Credentials and token (v0.3).** OneMap issues a short-lived access token from a login. The secrets manager holds the login credentials (P10). The token is shared between the api and worker processes through one row in `provider_sessions` (provider, token, expires_at, refreshed_at), because T1 runs two processes and memory is not shared. Any process reads the row first. If the token is missing or within `onemap.token_refresh_margin_minutes` of expiry, it takes `pg_advisory_xact_lock(hashtextextended('psess:onemap',0))` with a `lock_timeout`, re-reads the row (another process may have just refreshed it), logs in only if still needed, writes the new token and expiry, and commits. One login per refresh window, regardless of process count. The lock is held for at most the OneMap timeout. Holding a database transaction open across an external call is normally avoided; it is accepted here because the call is bounded by the 5 s timeout and the breaker, only a refresh ever takes the lock, and the table has one row per provider. On a 401 a process forces one refresh through the same path. No external cache is added (BP-12). The token column is excluded from logs and error payloads (§5.3). The reviewer states the token lifetime is 3 days; I have not verified that figure, so the refresh logic keys off the expiry the API returns (OI-6).
- **Merge and index (v1.0).** The geocode completion uses the JSONB concatenation operator (`venue_snapshot || :fields`), which replaces top-level keys only. The snapshot keeps its fields at top level, and `address` is empty before completion, so no nested data is lost. A partial expression index keeps the worker poll cheap on `games` and on `tournaments`: `CREATE INDEX … ON <table> ((venue_snapshot->>'geocoding_status')) WHERE (venue_snapshot->>'geocoding_status') = 'pending'`. The poll query and the compare-and-set predicate must use exactly this expression, or the planner will not use the index. Whether the ORM emits `||` or needs a raw statement is a Phase 1 check (OI-9).
- Neither the credentials nor the token is ever logged (§5.3).

**AD-9: Three layers of venue detail (VC-10, VC-12, VC-13).**
1. Synced fields: owned by the loader.
2. Shared admin layer: `venue_images` and admin text, owned by admins.
3. Organizer layer: `venue_user_images` and notes, stored against the game or tournament, never against the shared venue.
- Display order on a game or tournament: its own organizer photos, then the shared admin photos for `venue_id`.
- Promotion: an admin selects an organizer image. The system **copies** the file into a new `venue_images` row (`origin = 'promoted'`, with `promoted_from_image_id`) and writes `admin_action_log`. Because it is a copy, removal of the source (uploader deletes it or leaves) does not affect the promoted image.
- Promotion is gated by `meetup.venue.image_promotion.enabled` (default **false**) until the privacy policy and T&C are updated (OI-2).
- Single-admin, audited, consistent with the lifecycle addendum OI-1 decision.

**AD-10: Image handling (P9, P16, P17).**
- Accept JPEG, PNG, WebP. Check magic bytes against the declared type. Enforce size and per-game count caps from config.
- Re-encode on ingest to strip EXIF (location and device data). Never trust the original filename.
- Store encrypted at rest. Serve through short-lived signed URLs. No public bucket.
- Uploader accepts a one-line ownership statement at upload; the timestamp is stored.
- Every image has a **Report** action. A report creates an admin queue item. An admin can take an image down. Taken-down images stop being served immediately.
- **Takedown is a purge, not a flag (v0.2, P12).** Takedown sets `status = 'removed'` at once and the storage object is deleted by the retention job within `meetup.venue.image.purge_hours`, recording `purged_at`. Takedown of any image also removes every other image with the same `sha256` or linked by `promoted_from_image_id`, in both `venue_images` and `venue_user_images`, so a privacy takedown on the source cannot leave a promoted copy behind. Deletion in backups follows the baseline backup expiry; that window is stated in the privacy policy (OI-2). Promoted copies still survive the **uploader leaving** (VC-13, unchanged owner decision); they do not survive a takedown.
- Rejected for now: automated image moderation (BP-12; revisit by the gate in §13).

**AD-11: Provider isolation: a deliberate deviation (D-1).** Each provider has its own config block, URL whitelist and row bounds. A failing or misconfigured provider is disabled and alerted. It does not stop the api or the other providers. The lifecycle addendum (AD-14) hard-fails the process on invalid config; that stays true for global config keys. See D-1.

**AD-12: Scheduling uses the existing worker loop (P5).** A table-driven loop (same pattern as tournament reminders) polls. For each enabled provider, if the last success is older than `interval_hours` (default 24), it runs a cheap change check: compare the source's `last_updated` against the stored `source_updated_at`. If unchanged → run recorded as `skipped_unchanged`, no download. Heartbeat `meetup.venue.feed.last_run.<provider>` is updated on every pass. A dead-man alert fires when no success or skip is recorded for `stale_alert_hours`.

---

## 4. Component / Integration Design

**Components**

| Component | Responsibility |
|---|---|
| `jobs/venue_extractors/sportsg.py`, `dus.py` | Fetch dataset from whitelisted URL, normalise, write `venues.csv` and `manifest.json` |
| `venues/loader.py` | Validate, diff, upsert, retire, write run row (AD-4, AD-5) |
| `venues/service.py` | Catalogue list/search, sport filter, snapshot builder, **Others** resolution |
| `venues/onemap.py` | Postal lookup with timeout, retry, breaker; shared token via `provider_sessions` |
| `venues/geocode_pass.py` | Worker pass that completes pending **Others** geocodes through `apply_venue_geocode` |
| `venues/images.py` | Upload validation, re-encode, storage, signed URL, report, takedown, promote |
| `venues/sports_import.py` | `.xlsx` tag import using the shared safe-parser |
| `jobs/venue_feed_loop.py` | Scheduling, change check, heartbeat |

**Endpoints (access rule declared per endpoint, P15)**

| Endpoint | Rule |
|---|---|
| `GET /venues?sport_id=&q=&cursor=` | Authenticated. Active venues only, tagged for the sport. Paged. |
| `GET /venues/{id}` | Authenticated. Includes shared images (signed URLs). |
| `GET /venues/postal/{code}` | Authenticated. Calls OneMap. Rate limited (P17). |
| Existing create/update game and tournament endpoints | Organizer (existing rule). Body accepts `venue_id` **or** `others{…}`. Server builds the snapshot. |
| `POST /games/{id}/venue-images`, `POST /tournaments/{id}/venue-images` | Organizer or active committee member of that item. |
| `DELETE /venue-images/{id}` (organizer layer) | Uploader or committee member of that item. |
| `POST /venue-images/{id}/report` | Authenticated viewer of that item. |
| `PUT /admin/venues/{id}/sports` | Platform admin. Audited. |
| `POST /admin/venues/sports/import` | Platform admin. Audited. |
| `POST /admin/venues/{id}/images`, `DELETE /admin/venue-images/{id}` | Platform admin. Audited. |
| `POST /admin/venue-images/{id}/promote` | Platform admin. Flag-gated. Audited. |
| `GET /admin/venue-feed-runs`, `POST /admin/venue-feed-runs/{id}/release` | Platform admin. Release audited. |

**Integration boundaries**

| Boundary | Failure behaviour |
|---|---|
| data.gov.sg (extractors) | Timeout (config). Backoff with jitter. On failure the run is `failed`; the catalogue keeps its last good data. Other providers unaffected. |
| OneMap | 5 s timeout, one retry on 5xx, breaker. While open, **Others** saves postal-code-only and is geocoded later. Catalogue unaffected. |
| Object storage (images) | Upload failure returns an error to the user. No partial rows (write row after the object is stored). Display degrades to no photos. |
| Worker loop | One provider's exception is caught per provider. The loop continues. |

---

## 5. Data Contracts

### 5.1 Schema (all additive; migrations written, not executed)

| Table / change | Key columns and constraints |
|---|---|
| `venues` | id, provider, provider_venue_key, name, block, street, postal_code, lat, lng, facilities JSONB, operating_hours JSONB, info_url, booking_url, status CHECK(active,retired), missing_runs INT, source_updated_at, last_seen_run_id, retired_at, created_at, updated_at; UNIQUE(provider, provider_venue_key); index on postal_code |
| `venue_sports` | venue_id, sport_id, tagged_by, tagged_at; UNIQUE(venue_id, sport_id). `sport_id` references the baseline sports table **(verify)** |
| `venue_feed_runs` | id, provider, run_id, schema_version, row_count, sha256, source_updated_at, status CHECK(running,succeeded,failed,skipped_unchanged,skipped_locked,rejected_anomaly,released), added, updated, unchanged, retired, invalid_rows, error_code, started_at, finished_at; UNIQUE(provider, run_id) |
| `venue_images` | id, venue_id, storage_key, content_type, bytes, sha256, origin CHECK(admin_upload,promoted), promoted_from_image_id, status CHECK(active,removed), purged_at, created_by, created_at; index on sha256 |
| `venue_user_images` | id, game_id NULL, tournament_id NULL (exactly one set, CHECK), storage_key, content_type, bytes, sha256, uploaded_by, ownership_statement_at, status CHECK(active,reported,removed), purged_at, created_at; index on sha256 |
| `provider_sessions` | provider PK, token, expires_at, refreshed_at. Holds the OneMap access token shared by api and worker (AD-8). Only the venues module reads or writes it |
| Indexes on `games` and `tournaments` | Partial expression index on `((venue_snapshot->>'geocoding_status')) WHERE (venue_snapshot->>'geocoding_status') = 'pending'` (AD-8) |
| `venue_image_reports` | id, image_kind, image_id, reported_by, reason, status CHECK(open,actioned,dismissed), created_at |
| games **(verify existing venue columns)** + | `venue_snapshot JSONB`, `venue_id UUID NULL` |
| `tournaments` + | `venue_snapshot JSONB`, `venue_id UUID NULL`. Existing `venue_label` stays and is filled from the snapshot name for old readers (P14) |
| `admin_action_log` | new `action_type` values: `venue_sports_update`, `venue_sports_import`, `venue_image_add`, `venue_image_remove`, `venue_image_promote`, `venue_feed_release`. Existing CHECK to be widened **(verify)** |

Identity columns now (checklist): `(provider, run_id)` idempotency for the loader; `sha256` for feed files and images; `venue_snapshot.schema_version` for the copy format (independent of the feed `schema_version`, BP-08).

### 5.2 Data lineage (one source per field)

| Field | Single source | "If it comes from elsewhere, it is a bug" |
|---|---|---|
| Catalogue name, address, coordinates | Loader from the provider file | Admin or user edits to synced fields |
| Sport tags | `venue_sports` (admins) | Inferring from dataset text |
| Venue shown on a game or tournament | Its own `venue_snapshot` | Joining live to `venues` |
| Shared photos | `venue_images` | Organizer table |
| Organizer photos | `venue_user_images` | `venue_images` |
| Others address and coordinates | OneMap response stored in snapshot | Client-supplied coordinates |
| Court count | Organizer entry | Catalogue |
| Last feed state per provider | `venue_feed_runs` | Cached counter |

### 5.3 Sensitive fields (excluded from logs, metrics, error payloads)

| Field | Handling |
|---|---|
| OneMap credentials and access token | Credentials in the secrets manager only. Token only in `provider_sessions` (encrypted at rest under the database baseline, P16). Neither is logged or returned in any payload. |
| Signed image URLs | Never logged. Short TTL. |
| Original image filename, EXIF | Dropped at ingest. Never stored or logged. |
| Reporter identity | Visible to admins only. |
| Uploader identity on promoted images | Not shown to anyone (VC-13); the original is in `admin_action_log`. |

---

## 6. Security & Compliance Considerations

**Threats and controls**
- **SSRF through extractor URLs:** URLs come only from per-provider config validated against a runtime whitelist (P1 addendum). No URL is ever taken from a feed file or user input.
- **Hostile feed file:** schema, size, row, bound and encoding checks before any write; HTTPS URLs only; text fields stored as data and escaped at output (P9).
- **Hostile `.xlsx` (tag import):** same rejections as the lifecycle upload (formulas, macros, external links, decompression ratio); values-only; all-or-nothing.
- **Malicious or embarrassing images:** magic-byte check, re-encode, size caps, report and takedown, ownership statement, signed URLs.
- **Identifiable people in photos:** an admin reviews before promotion. Promotion stays off until T&C and privacy policy cover it (OI-2). Account deletion removes the user's organizer-layer images (P12). Promoted copies remain by owner decision (VC-13); this is a known residual risk, see R-4.
- **Scraping of the catalogue:** list endpoints are paged, rate limited per user and at the gateway (P17).
- **Authorisation:** every endpoint in §4 declares its rule. Admin rules are enforced at the entry point. No RLS added (P15).
- **Encryption:** images and feed files at rest under managed keys (P16). TLS in transit.
- **Licence:** data.gov.sg Open Data Licence permits commercial use with attribution. The attribution text and where it appears is OI-7.

**Compliance (PDPA / MAS TRM context):** catalogue data is not personal data. Photos may contain personal data; handled by retention (OI-10), deletion on account removal, and the T&C gate. Admin actions are audited.

**Negative tests (P13), mandated:** §9.

---

## 7. Configuration and Failure Modes

### 7.1 `app_config` keys (P1; validated at startup; global keys hard-fail if missing)

| Key | Default | Bounds |
|---|---|---|
| `meetup.venue.catalogue.enabled` | false | boolean, parsed explicitly |
| `meetup.venue.feed.interval_hours` | 24 | 6–168 |
| `meetup.venue.feed.poll_seconds` | 600 | 60–3600 |
| `meetup.venue.feed.missing_runs_before_retire` | 2 | 1–5 |
| `meetup.venue.feed.max_retire_fraction` | 0.2 | 0.01–0.5 |
| `meetup.venue.feed.min_row_fraction` | 0.8 | 0.5–1.0 |
| `meetup.venue.feed.stale_alert_hours` | 72 | 24–720 |
| `meetup.venue.feed.fetch_timeout_seconds` | 30 | 5–120 |
| `meetup.venue.feed.rename_min_similarity` | 0.80 | 0.5–1.0 |
| `meetup.venue.feed.last_run.<provider>` | runtime | heartbeat |
| `meetup.venue.provider.<id>.enabled` | false | boolean (per provider) |
| `meetup.venue.provider.<id>.source_urls` | none | whitelist, HTTPS only (per provider) |
| `meetup.venue.provider.<id>.min_rows` / `max_rows` | per provider | sanity bounds (per provider) |
| `meetup.venue.provider.<id>.max_invalid_fraction` | 0.02 | 0–0.2 |
| `meetup.venue.geo.bounds` | Singapore box | lat/lng min/max |
| `meetup.venue.onemap.timeout_seconds` | 5 | 1–15 |
| `meetup.venue.onemap.breaker_threshold` / `cooldown_seconds` | 5 / 120 | |
| `meetup.venue.onemap.token_refresh_margin_minutes` | 60 | 5–720 |
| `meetup.venue.geocode.retry_poll_seconds` | 300 | 60–3600 |
| `meetup.venue.geocode.give_up_hours` | 72 | 1–720 |
| `meetup.venue.image.purge_hours` | 24 | 1–168 |
| `meetup.venue.image.max_bytes` | 5242880 | 65536–15728640 |
| `meetup.venue.image.max_per_item` | 5 | 1–20 |
| `meetup.venue.image.max_per_venue_shared` | 12 | 1–50 |
| `meetup.venue.image.signed_url_ttl_seconds` | 300 | 30–3600 |
| `meetup.venue.image_promotion.enabled` | false | boolean, parsed explicitly |
| `meetup.venue.sports_import.max_bytes` / `max_rows` | 2097152 / 5000 | |
| `meetup.venue.search.page_size` | 20 | 5–50 |

Secrets (not config): OneMap login credentials.

### 7.2 Failure modes

| Failure | Behaviour |
|---|---|
| Provider down or file invalid | Run `failed`. Catalogue keeps last good data. Alert after `stale_alert_hours`. |
| Feed shrinks sharply | `rejected_anomaly`. No change. Admin notified. |
| Provider misconfigured | That provider disabled and alerted. Others and api continue (D-1). |
| OneMap down | **Others** saves with postal code only, `geocoding_status = 'pending'`; retried by the worker. Catalogue works. |
| Storage down | Uploads refused. Existing pages show no photos. |
| Catalogue flag off | Free-text venue flow as today. |
| Loader killed mid-run | Single transaction per run: rolled back, next run retries (idempotent). |

---

## 8. Observability & Operability (P4)

- Every extractor and loader run carries `run_id` and a correlation ID in all logs.
- Metrics per provider: run duration, rows read, added, updated, retired, invalid, status, age of last success.
- **Alerts** (on thresholds, not per error): no success or skip for `stale_alert_hours`; any `rejected_anomaly`; OneMap breaker open more than N minutes; image upload failure rate.
- Admin actions (tags, images, promotion, releases) go to the security/audit stream and `admin_action_log`.
- PII/secret masking applied before logs reach aggregation (P4 addendum).
- Admin console shows feed runs (status, counts, retired list) and the image report queue.
- Expectation note: both launch datasets update rarely (annual and 2024). The daily job will mostly record `skipped_unchanged`. That is correct behaviour, not a fault.

---

## 9. Test Plan (mandated negative tests)

**Access (API level, database backstop absent, P13/P15)**
1. Non-admin calls every `/admin/venue*` endpoint → 403.
2. Non-organizer uploads an image to someone else's game or tournament → 403/404.
3. User deletes another user's organizer image → 403.
4. `promote` with the flag off → rejected. Non-admin → 403.
5. Retired venue's `venue_id` on create → 422. `venue_id` not tagged for the sport → 422.
6. Client-supplied coordinates for **Others** are ignored. Postal code not 6 digits → 422.
7. Signed URL after expiry → denied. Taken-down image → not served.

**Loader**
8. Same file delivered twice → no change; second run a no-op.
9. `sha256` or `row_count` mismatch → run `failed`, zero rows changed.
10. Row with bad postal, out-of-bounds coordinates or `javascript:` URL → counted invalid. Over the bound → whole run `failed`.
11. Venue absent once → still active. Absent twice → retired. Reappears → active again, tags and images intact.
12. Rename: one missing and one new key at a postal code with similarity ≥ threshold → same `id`, tags and images preserved. Two missing or two new at that postal code, or similarity below threshold → retire plus insert; the new row has no tags or images.
12a. Two source rows with the same base key → extractor emits distinct keys and records the collision count; a hand-made file with duplicate keys → run `failed`.
13. Feed with a large drop → `rejected_anomaly`, nothing retired. Admin release → applies.
14. Two concurrent runs for one provider → one runs, one `skipped_locked`.
15. Feed change or retirement does not alter any existing game or tournament snapshot.
16. One provider failing does not stop another in the same loop pass.

**Files**
17. Hostile `.xlsx` (formula, macro, external link, zip bomb, oversize) → rejected whole, nothing saved.
18. Image with mismatched magic bytes, oversize, or over per-item count → rejected. EXIF absent from stored output.
19. Takedown of a source image also removes the promoted copy and any same-`sha256` image; objects are gone from storage after `purge_hours` and `purged_at` is set.
20. OneMap down → **Others** with a valid 6-digit code saves as `pending`; non-6-digit → 422. Worker later fills coordinates once. A snapshot of `source != 'user'` is never touched by the geocode pass.
20a. Organizer changes the venue while a geocode is pending → the late geocode result is not applied (predicate fails); the new snapshot is unchanged.
21. Expired OneMap token with api and worker both needing it at once → exactly one login call, both succeed; a 401 forces one refresh only; credentials and token never appear in logs.

**Other:** contract tests for the manifest schema; migration up/down on a copy; UI e2e that the picker shows only sport-matching venues and **Others** always appears.

---

## 10. Implementation Phases

Each phase ends with an implementation report (as-built schema and deviations) written back here (BP-13). Everything ships behind `meetup.venue.catalogue.enabled = false`, so merges are safe.

| Phase | Content | Acceptance |
|---|---|---|
| 1. Verify & foundations | Confirm games venue columns, sports table, `admin_action_log` CHECK, tournament `venue_label`, storage plan, config keys, JSONB merge and expression-index behaviour (OI-9) | Schema facts recorded (BP-01); startup validation of config |
| 2. Feed | Tables, manifest contract, SportSG and DUS extractors, loader, run table, worker loop, heartbeat | Tests 8–16 |
| 3. Catalogue API | List, search, detail, sport filter, **Others** with OneMap, snapshot builder | Tests 5–6 |
| 4. Create/edit integration | Game and tournament create/edit accept venue; snapshot; legacy display fallback | Test 15; existing tests green |
| 5. Admin | Tag editor, `.xlsx` import, feed-run screen (retired venues flagged when they had tags or images, with likely replacements), release | Tests 1, 17 |
| 6. Organizer images | Upload, display, report, delete, retention job | Tests 2–3, 7, 18 |
| 7. Shared images and promotion | Admin upload, curate, promote (flag off) | Test 4 |
| 8. Enable | Seed tags, flip catalogue flag, soak | §11 gate |

---

## 11. Deployment & Rollback

- Migrations additive. Rollback = leave tables unused; code rollback via redeploy. No column dropped or retyped.
- Worker deploy order: migration → api → worker.
- **Enable gate:** tags seeded for each launch sport (OI-1), at least one successful run per provider, no `rejected_anomaly` outstanding, manual walk-through of create game and create tournament on iOS and Android.
- Rollback: set `meetup.venue.catalogue.enabled = false` (free-text flow returns). Disable one provider with its own flag. Existing games are unaffected either way, because they hold snapshots.
- Existing games and tournaments are **not** backfilled with `venue_id`. They display their original text (VC-14, P14).

---

## 12. Principles & Best-Practices Compliance

| Principle | Design element | Status |
|---|---|---|
| P1 Config-driven | §7.1, per-provider whitelist and bounds | Met |
| P2–P4 | Baseline; P4 metrics and alerts in §8 | Met |
| P5 Idempotency | `(provider, run_id)`, advisory lock, idempotent loader | Met |
| P6 Immutable context | `venue_snapshot` on each game or tournament | Met |
| P7 Fault isolation | Per-provider isolation, OneMap breaker, storage degrade | Met |
| P8 Determinism | Same file ⇒ same result | Met |
| P9 Validate at boundary | Server-side sport check, feed validation, `.xlsx`, images | Met |
| P10 Least privilege | Token in secrets manager; admin-only endpoints | Met |
| P11 | Not applicable | n/a |
| P12 Retention | Anomaly guard met; organizer-image retention period **open** (OI-10) | **Open** |
| P13 Negative tests | §9 | Met |
| P14 Additive evolution | §5.1, §11, no backfill | Met |
| P15 Shift-left authz | Rule per endpoint in §4 | Met |
| P16 Encryption | Images and feeds encrypted | Met (storage plan OI-5) |
| P17 Rate limits | List, search, postal lookup, upload | Met |
| BP-01 Verify schema | Phase 1; **(verify)** marks in §5.1 | Planned |
| BP-08 Version domains | Feed `schema_version` vs snapshot `schema_version` | Met |
| BP-10 Measurable gates | §13 | Met |
| BP-12 T1 simplicity | No queue, no moderation service, no catalogue linkage | Met |
| BP-13 Write-back | Per-phase reports | Planned |

**Deliberate deviations (flagged)**

| # | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | A misconfigured or failing **provider** is disabled and alerted; the process keeps running | `Enterprise_Design_Principles.md` P1 (invalid required config is a hard failure) and lifecycle addendum AD-14 | A third-party feed must not be able to take the app down. Global venue keys still hard-fail at startup. Provider keys are optional and per-provider. Owner decision. |
| D-2 | Requirements restated in-document, not an approved REQ addendum | `solution-design` precondition | Process note 1; same as lifecycle D-5 |
| D-3 | Single-admin image promotion, no dual control | Spirit of P12 dual control (that clause applies to bulk deletes, not promotion) | Not a bulk delete; audited; consistent with lifecycle OI-1. Listed for visibility, not a breach. |

---

## 13. Deferred Decisions (measurable upgrade gates, BP-10)

| Deferred | Why | Gate to revisit |
|---|---|---|
| Automated image moderation | T1 volume, admin review exists | More than 50 reported images in 30 days, or any single takedown for illegal content |
| Per-court catalogue and court counts | No source data | A provider supplies court counts in a file |
| Shared catalogue entries for popular **Others** venues | Owner chose copy-only | More than 20 organizers pick the same **Others** postal code in 90 days |
| Auto-hide on N reports | Admin queue sufficient | Median report-to-takedown time above 48 h over 30 days |
| Availability or booking deep links | No public API | ActiveSG publishes a documented API |
| Second admin for promotion | Single admin accepted | Two or more platform admins exist (lifecycle OI-1 trigger) |
| PostGIS / spatial index and "nearby" sort | No nearby requirement stated; catalogue is a few hundred rows; adding a column and index later is an additive migration. Sorting a few hundred rows in the app is enough. | Owner approves a "nearby" requirement, **or** active venues exceed 5,000, **or** p95 `GET /venues` latency exceeds 200 ms over 7 days |
| Trigram index on `venues.name` | A scan of a few hundred sport-filtered rows is sub-millisecond | Same row-count and latency gate as above |

---

## 14. Open Items

| ID | Item | Severity | Blocking |
|---|---|---|---|
| OI-1 | Venue and DUS counts unknown. The effort to seed sport tags and the launch sport list are not sized. Needed before the enable gate. | 🟡 MEDIUM | Phase 8 only |
| OI-2 | Privacy policy and T&C wording for user-submitted venue photos, the licence granted to the platform, and promotion. Required before `image_promotion.enabled` is turned on. Owner to approve wording (not legal advice; I am not a lawyer). | 🟠 HIGH | Phase 7 enablement only |
| OI-3 | Lifecycle OI-9 (native bottom bar on wizards and detail screens) applies to the new picker screens. Follow canvas boards until the owner decides. | 🟡 MEDIUM | No |
| OI-4 | Changing the venue of a **published** tournament versus fixtures with per-match venue overrides and lifecycle AD-9 reschedule rules. Proposal: allowed only as a committee `fixture_reschedule` action; per-match venues are not auto-updated. Owner to decide. | 🟡 MEDIUM | No |
| OI-5 | AWS hosting plan: object storage for images and feed files, and key management. Local disk is acceptable only until the AWS bucket plan exists. | 🟡 MEDIUM | Phase 6 |
| OI-6 | OneMap: licence and caching terms, rate limits and token lifetime are unverified (a reviewer states 3 days; the refresh logic does not depend on it). The postal-code-only fallback (AD-8) replaces the earlier "refuse" proposal; owner to confirm. | 🟡 MEDIUM | Phase 3 |
| OI-7 | Open Data Licence attribution: exact text and placement in the app. To verify against the licence. | 🟡 MEDIUM | Phase 8 |
| OI-8 | Dataset freshness: DUS data was last updated June 2024 and SportSG annually. Hours and availability of school facilities may be wrong. UI must not imply live hours. | 🟡 MEDIUM | No |
| OI-9 | Phase 1 schema verification (BP-01): games venue columns, sports table, `admin_action_log` CHECK; PostgreSQL version and how the ORM issues the JSONB `||` merge for the geocode compare-and-set (raw statement if it does not); the partial expression index builds on both tables. | 🟡 MEDIUM | Phase 1 gate |
| OI-10 | Retention period for organizer images and removed images. Proposed default: delete 90 days after the event ends, and on account deletion. Owner to confirm and reflect in privacy policy. | 🟡 MEDIUM | No |
| OI-11 | Source tag wording. The picker shows "ActiveSG", but the data is SportSG facilities and MOE school facilities, not an ActiveSG feed. Owner to confirm the label ("ActiveSG" vs "Sport SG" vs "Listed venue"). | 🟡 MEDIUM | No |

Status: v1.0 APPROVED by the owner on 2026-10-15. No blocking items for Phases 1–3.

---

## 15. Risks & Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Rename or restructure at the source looks like a mass removal | Postal-code rename match, two-run delay, anomaly guard, admin release |
| R-2 | Stale datasets give wrong hours or a closed venue | No availability claims, hours labelled as listed, organizer re-pick, OI-8 |
| R-3 | A venue legitimately missing from datasets (private halls) | **Others** is always available |
| R-4 | Promoted photo shows an identifiable person; uploader later asks for removal | Admin review before promotion, T&C gate (OI-2), admin takedown path, promotion off by default |
| R-5 | Sport tags incomplete → the venue a user wants is missing | **Others** fallback, admin tag editor, enable gate OI-1 |
| R-6 | No stable provider ID → duplicate venue rows on a rename | Rename matching; admin can see run diffs |
| R-7 | OneMap outage degrades **Others** (no pin until retried) | Postal-code-only save, worker retry, alert after `give_up_hours`; catalogue path unaffected |
| R-8 | Misleading "ActiveSG" label | OI-11 |

---

## 16. Requirements Coverage

| Requirements | Section |
|---|---|
| VC-01, VC-03 | AD-6, §5.1 |
| VC-02 | AD-2, AD-3 |
| VC-04 | AD-8 |
| VC-05, VC-06 | AD-7 |
| VC-07 | AD-3, AD-4, AD-12 |
| VC-08 | AD-5 |
| VC-09 | AD-6 |
| VC-10, VC-12, VC-13 | AD-9, AD-10 |
| VC-11 | AD-6 |
| VC-14 | §11, AD-6 |

---

## 17. Review Log

| Version | Date | Note |
|---|---|---|
| v0.1 | 2026-10-15 | First draft from the 2026-10-15 elicitation. |
| v0.2 | 2026-10-15 | Review round 1 (below). |
| v0.3 | 2026-10-15 | Review round 2 (below). |
| v1.0 | 2026-10-15 | Review round 3 (below). **Approved by the owner, 2026-10-15.** |

**Round 1 (2026-10-15, external review, v0.1 → v0.2)**

| Finding | Classification | Outcome |
|---|---|---|
| Rename by postal code is fragile (co-located facilities) | Valid new finding, 🟠 HIGH | AD-5 tightened: 1:1 swap at the postal code **and** name similarity ≥ 0.80 (config). The 1:1 condition is stronger than the reviewer's fix and covers the split/merge case. Safe failure mode stated. |
| Key collisions across multi-facility rows | Partly valid, 🟡 MEDIUM | The premise (DUS has one row per facility type) does not match the record layout I read: one row per school, facilities as text. Collision handling was nonetheless undefined. AD-3 now makes uniqueness the extractor's duty with a disambiguator and a recorded count; Phase 2 verifies on real files. A blanket facility-slug suffix was not adopted: it would split one school into several picker entries. |
| Add PostGIS and spatial index now | Rejected, out of tier (BP-12) | No "nearby" requirement exists. A few hundred rows need no spatial index, and adding one later is additive, so the "costly rebuild" claim does not hold. Recorded as a deferred decision with measurable gates (§13). |
| Hard-block on OneMap outage hurts conversion | Valid, 🟡 MEDIUM | This was my proposal, not an owner decision. AD-8 now saves postal-code-only and retries through the existing worker loop. The reviewer's separate queue was not adopted (BP-12). The snapshot write-back is limited and documented. |
| OneMap token expires | Valid, 🟡 MEDIUM | AD-8: secrets manager holds login credentials; token refreshed in process before expiry. Redis cache not adopted: there is none in the T1 stack. The 3-day figure is unverified (OI-6). |
| `pg_trgm` index on name | Rejected as premature | Same reasoning as PostGIS; gate in §13. |
| Promoted copy survives erasure or takedown | Split. Takedown purge: valid gap, 🟠 HIGH. Promoted copy surviving the uploader leaving: **deliberate owner decision (VC-13), defended.** | AD-10: takedown is now a hard purge across both tables, including copies linked by `promoted_from_image_id` or same `sha256`. VC-13 is unchanged: promotion needs admin review and the T&C licence (OI-2), so the uploader's departure does not revoke it. A depicted person's erasure request is served by takedown. |
| "Approved for Phase 1 and 2" | Not accepted as a status | Approval is the owner's, not the reviewer's. Given by the owner in v1.0. |

**Round 2 (2026-10-15, external review, v0.2 → v0.3)**

| Finding | Classification | Outcome |
|---|---|---|
| Async geocode write conflicts with immutable snapshot (AD-8 vs AD-6) | Partly valid, 🟡 MEDIUM | The concurrency and module-boundary gaps were real. Fixed with a single atomic compare-and-set (no row lock, a late result cannot overwrite an organizer's change) and a narrow games/tournaments interface function. The separate pending-geocode table was **rejected**: two sources of truth and a read-time join for every game view. P6 holds because the organizer's chosen inputs are untouched. |
| Token cached in process memory, but T1 has two processes | Valid new finding (my design error), 🟠 HIGH | Token moved to `provider_sessions` in Postgres with an advisory-lock refresh (AD-8). One login per refresh window. No Redis. Whether OneMap allows one session per account is unverified, and the design is safe either way (OI-6). |
| 1:1 swap constraint misses compound changes | Not a defect; reviewer agrees it fails safe | No change to the rule. Added the admin flag for retired venues that had tags or images, with likely replacements at the same postal code (AD-5, Phase 5). |
| "Ready for owner sign-off" | Noted | Sign-off is the owner's. Done in v1.0. |

**Round 3 (2026-10-15, external review, v0.3 → v1.0)**

| Finding | Classification | Outcome |
|---|---|---|
| Advisory lock held across the OneMap HTTP call | Accepted risk, 🟢 LOW | Recorded in AD-8 with the reason: bounded by the 5 s timeout and breaker, refresh-only, one row per provider. |
| JSONB `||` is a shallow merge; check ORM support | Valid watchpoint, 🟢 LOW | Documented in AD-8 (top-level fields only, `address` empty beforehand). ORM behaviour added to the Phase 1 gate (OI-9). |
| Partial expression index for the pending poll | Accepted | Added to AD-8 and §5.1 for `games` and `tournaments`. Added the rule that the poll and compare-and-set must use the identical expression, otherwise the planner skips the index. |
| Phase 5 admin flag for retired tagged venues | Already in v0.3 | No change. |

No finding changed an approved decision. No outstanding blocking items.

**Approved by the owner, 2026-10-15.** Next: Phase 1 per §10, recording the as-built schema facts back into this document (BP-13).
