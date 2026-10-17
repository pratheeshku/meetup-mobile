# Document index
Each document's header holds its current version and status; this index deliberately carries neither. Amendment history: CHANGELOG-DOCS.md. The backend repo (`~/meetup/docs/INDEX.md`) holds the platform requirements and design.

## Requirements and baseline design
- REQ-MEETUP-MOBILE.md: mobile requirements (R-xxx). Use to check what must be true.
- DES-MEETUP-MOBILE.md: mobile baseline design (navigation, API client, token storage, push, create flows).

## Design addenda (read together with the baseline)
- DES-MEETUP-ADDENDUM-IOS-App.md, -IOS-PN-Support.md: iOS app and iOS push.
- DES-MEETUP-ADDENDUM-email-auth.md, -social-login.md: email auth and login providers.
- DES-MEETUP-ADDENDUM-dashboard.md: dashboard and the bottom bar navigation rules.
- DES-MEETUP-ADDENDUM-tournament-lifecycle.md: tournament v2 (see also the mobile brief for it).
- DES-MEETUP-ADDENDUM-approval-context-signing.md, -profile-onboarding.md: approvals, first-run profile steps.
- DES-MEETUP-MOBILE-ADDENDUM-shareable-links.md: share links and deep links.
- MOBILE-ADDENDUM-skill-level-delete.md, MOBILE-ADDENDUM-sports-filter-preselect.md: mobile-only features.
- DES-MEETUP-FEEDBACK-001 — Terminology, Navigation, Group Invite & Share Link.md: feedback-driven UI and terminology rules.
- Several addenda are copies of the backend repo's; the backend copy is the one the owner updates and may be newer. If they differ, ask.

## Governing files (apply to every design and review)
- Enterprise_Design_Principles.md (P1-P17) and design-best-practices.md (BP-01-BP-13). Not in this repo; they live in the owner's Architect Project and the Sadhana repo.

## Active work
- Build briefs live in the backend repo: `~/meetup/docs/briefs/` (tournament Release 1 mobile, venue catalogue mobile). Read only the brief for your task ID.
- status/: per-task status files (for example `vc-m-*-status.md`). Update the one for your task ID.
- ../implementation-status-*.md (repo root): per-design implementation status.

## Design reference (UI)
- Canvas (human only, agents cannot read it): https://claude.ai/artifact/SRavBx8jwnK8kK1QjVovnM. Board names match it.
- design-ref-venue/: venue boards. `png/` for the look, `html/` for exact sizes, spacing and tokens (plain inline-styled markup; read it for dimensions). Key boards: Game3When, EditGame2, TournSched*, FXEdit*, GameDetail.
- design/notifications/: notifications screen captures (`design/notifcations/` is an older misspelt copy).
- ../design-ref/ (group screens), ../design-ref-p23/, ../design-refs/home-v2/ (repo root): earlier reference sets.
- Boards labelled "Phase 2" are not built. If no board exists for a screen, build it minimal with existing components and tokens, then ask the owner to review.

## Reference (search, do not read in full)
- reports/: implementation, audit and diagnostic reports (about 110). rca/: root-cause analyses.
- glossary.json, label-inventory-mobile.json: UI labels (`npm run check:labels` checks them).
