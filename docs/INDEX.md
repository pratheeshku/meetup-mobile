# Document index
Each document's header holds its current version and status; this index deliberately carries neither. Amendment history: CHANGELOG-DOCS.md. The backend repo (`~/meetup/docs/INDEX.md`) holds the platform requirements and design.

## Requirements and baseline design
- REQ-MEETUP-MOBILE.md: mobile requirements (R-xxx). Use to check what must be true.
- DES-MEETUP-MOBILE.md: mobile baseline design (navigation, API client, token storage, push, create flows).

## As-built design and requirements (reverse-engineered from code; read with the baseline, never instead of it)
Per-module files, one folder per kind so no folder is flooded. They describe what the code does, not what was approved. Read only the area you touch. Each file ends with its own drift and findings. Version and status are not recorded here or in the files; the owner assigns them.
- Change logs (record every edit to these files here, not in CHANGELOG-DOCS.md): as-built/changelog/DESIGN-CHANGELOG.md, as-built/changelog/REQUIREMENTS-CHANGELOG.md.
- architecture_overview: as-built/design/architecture_overview.md. Stack, layout, runtime composition, cross-cutting findings (design only).
- api: as-built/design/api.md, as-built/requirements/api.md. Axios client, refresh, domain modules, endpoint inventory (checked against the backend).
- auth_storage: as-built/design/auth_storage.md, as-built/requirements/auth_storage.md. Sign-in, session restore, token storage.
- navigation: as-built/design/navigation.md, as-built/requirements/navigation.md. Stacks, tabs, create flow, completion.
- notifications: as-built/design/notifications.md, as-built/requirements/notifications.md. FCM, local rendering, routing, history.
- screens: as-built/design/screens.md, as-built/requirements/screens.md. All 27 screens.
- components: as-built/design/components.md, as-built/requirements/components.md. Shared and feature components, icons.
- hooks_utils: as-built/design/hooks_utils.md, as-built/requirements/hooks_utils.md. Hooks, game lists, helpers.
- labels_theme_diagnostics: as-built/design/labels_theme_diagnostics.md, as-built/requirements/labels_theme_diagnostics.md. Labels, theme, sports, perf log, config.

## Design addenda (read together with the baseline)
- DES-MEETUP-ADDENDUM-IOS-App.md, -IOS-PN-Support.md: iOS app and iOS push.
- DES-MEETUP-ADDENDUM-email-auth.md, -social-login.md: email auth and login providers.
- DES-MEETUP-ADDENDUM-decline-response.md: Accept and Decline on invited, public and joined games and tournaments, a remembered Declined state (hidden from the user's lists), the organizer's Accepted / Pending / Declined response list, push buttons Accept and Decline (replaces Ignore for game and tournament invitations). Approved 2026-10-20. Tasks dr-backend (after cr-backend), dr-web, dr-mobile. Briefs: `~/meetup/docs/briefs/BRIEF-decline-response-backend-web.md`, `BRIEF-decline-response-mobile.md`.
- DES-MEETUP-ADDENDUM-dashboard.md: dashboard and the bottom bar navigation rules. v1.9 adds the Upcoming games definition (AD-20) and the Games screen status filter (AD-21).
- DES-MEETUP-ADDENDUM-tournament-lifecycle.md: tournament v2 (see also the mobile brief for it). v1.4 adds the tournament closure report (AD-18) and the creation wizard (AD-20, AD-19).
- DES-MEETUP-ADDENDUM-push-actions.md: action buttons on push for game invite (Accept, Ignore), tournament invite (Accept, Ignore) and group addition (Leave group, Ignore); per-device capability gate and kill switch. Task pa-clients-mobile. (Ignore is replaced by Decline for game and tournament invites: decline-response D-1.)
- DES-MEETUP-ADDENDUM-game-view-redesign.md: game/tournament view page and Games list changes of 2026-10-21 (scope order Mine|Public|All with Mine default, Active|All switch in the scope row, venue pop-up, invite-type row and Invited sheet, organizer Responses block replacing Players, grouped listings, multi-select invite picker, combined user pop-up, Close section last, Registrations tab folded into Responses). Approved 2026-10-21. Mobile scope is task gv-mobile; boards docs/design/game-view-redesign/ (png for look, html for sizes). Brief in chat only, not committed.
- DES-MEETUP-ADDENDUM-closure-report.md: game and tournament closure report, computed lifecycle status (active, cancelled, past, closed), Played/Won/Hosted source, upcoming window, past-date validation, active/all toggle. Approved 2026-10-20. Mobile scope is task cr-mobile, after cr-backend is deployed. Brief: `~/meetup/docs/briefs/BRIEF-closure-report-mobile.md`.
- DES-MEETUP-ADDENDUM-invitation-response.md: Accept on a game invitation means joining (going or waitlisted); mobile scope is task ia-clients (show the outcome, keep Accept/Decline on refusal). Brief: `~/meetup/docs/briefs/BRIEF-invitation-response.md`.
- DES-MEETUP-ADDENDUM-access-consistency.md: no access means no view; mobile scope is AD-8 only (refetch on open, 404 closes the screen). Brief: `~/meetup/docs/briefs/BRIEF-access-consistency-mobile.md`.
- DES-MEETUP-ADDENDUM-user-details-menu.md: one reusable user menu on every avatar or name (mobile: tap opens View Details, long-press opens the menu; web: click), View Details first, server-computed role actions, labels via admin. Mobile scope is tasks ud-p1-verify-mobile and ud-mobile; UI build gated on a board (OI-6) and on ud-backend being deployed. Brief: `~/meetup/docs/briefs/BRIEF-user-details-menu-mobile.md`.
- DES-MEETUP-ADDENDUM-approval-context-signing.md, -profile-onboarding.md: approvals, first-run profile steps.
- DES-MEETUP-MOBILE-ADDENDUM-shareable-links.md: share links and deep links.
- MOBILE-ADDENDUM-skill-level-delete.md, MOBILE-ADDENDUM-sports-filter-preselect.md: mobile-only features.
- DES-MEETUP-FEEDBACK-001 — Terminology, Navigation, Group Invite & Share Link.md: feedback-driven UI and terminology rules.
- Several addenda are copies of the backend repo's; the backend copy is the one the owner updates and may be newer. If they differ, ask.

## AI models and tools
- Backend repo: `~/meetup/docs/AI-MODELS.md`. Which AI model or tool to use for which scenario, routing rules and known trust issues. Single copy; do not duplicate here.

## Governing files (apply to every design and review)
- Enterprise_Design_Principles.md (P1-P17) and design-best-practices.md (BP-01-BP-13). Not in this repo; they live in the owner's Architect Project and the Sadhana repo.

## Active work
- Build briefs live in the backend repo: `~/meetup/docs/briefs/` (tournament Release 1 mobile, venue catalogue mobile, access consistency mobile, user details menu mobile, closure report mobile). Read only the brief for your task ID.
- status/: per-task status files (for example `vc-m-*-status.md`). Update the one for your task ID.
- ../implementation-status-*.md (repo root): per-design implementation status.

## Design reference (UI)
- Canvas (human only, agents cannot read it): https://claude.ai/artifact/SRavBx8jwnK8kK1QjVovnM. Board names match it.
- design-ref-venue/: venue boards. `png/` for the look, `html/` for exact sizes, spacing and tokens (plain inline-styled markup; read it for dimensions). Key boards: Game3When, EditGame2, TournSched*, FXEdit*, GameDetail.
- design/notifications/: notifications screen captures (`design/notifcations/` is an older misspelt copy).
- mockups/user-menu/: user details menu board (user-menu-board.png for look, .html for sizes): menu, View Details, confirmation, notices, home-card avatars, tournament rows, web popover. APPROVED by the owner 2026-10-19 (design v1.3, OI-6 closed).
- ../design-ref/ (group screens), ../design-ref-p23/, ../design-refs/home-v2/ (repo root): earlier reference sets.
- Boards labelled "Phase 2" are not built. If no board exists for a screen, build it minimal with existing components and tokens, then ask the owner to review.

## Reference (search, do not read in full)
- reports/: implementation, audit and diagnostic reports (about 110). rca/: root-cause analyses.
- glossary.json, label-inventory-mobile.json: UI labels (`npm run check:labels` checks them).
