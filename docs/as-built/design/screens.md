# As-built design: mobile screens (`src/screens`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/screens.md](../requirements/screens.md) · [components](components.md) · [navigation](navigation.md) · `docs/INDEX.md` "Design reference (UI)" (boards) · `docs/DES-MEETUP-MOBILE.md` §4

## Purpose
27 screens (about 13.9k lines). Large screens carry their own state and wizard logic; shared parts live in `src/components`. Role and permission gating is UX only; the backend decides.

## Screens
| Screen | Lines | API modules used | Notes |
|---|---|---|---|
| `LoginScreen`, `RegisterScreen`, `VerifyScreen`, `ForgotPasswordScreen` | 327, 437, 245, 281 | via `auth/` | email auth and social buttons; generic error text; 60 s resend cooldown on verify |
| `HomeScreen` | 714 | events, groups, home, profile, sports | banner carousel, tabs (Upcoming games / My groups), sport chips, next-game card, create card, bell badge |
| `GamesScreen` | 394 | events, profile, sports | Games \| Tournaments switch; scope All / Mine / Open; sport filter with skill-based default |
| `CreateGameScreen` | 1578 | config, events, groups, places, sports, tournaments | wizard; Casual / Tournament toggle; venue picker (catalogue or Others); group sharing; email invites; skill requirement; player limits from `/config/game-limits` |
| `EventDetailScreen` | 2121 | config, events, groups, places | game detail and edit wizard; RSVP / withdraw; participants; invitations; cancel; share |
| `TournamentDetailScreen` | 453 | config, tournaments | fixtures as returned (no client computation); register / withdraw; invitation banner and invite panel |
| `GroupsScreen`, `GroupDetailScreen` (890), `CreateGroupScreen` (411), `EditGroupScreen` (382), `InviteMembersScreen` (280) | | groups, teams, sports, home | players groups and tournament teams (create only); member management; invite step 2; logo upload |
| `TournamentTeamsScreen` | 45 | none | "coming soon" strip |
| `ProfileScreen` (811), `EditProfileScreen` (832), `EditSkillLevelsScreen` (326), `SettingsScreen` (460) | | profile, mobileNumber, sports, groups, home | cover and avatar upload, skill levels, mobile number with consent, notification switches, support, terms/privacy, account deletion entry |
| `AccountDeletionBlockedScreen` (365), `TransferGroupOwnershipScreen` (396), `AccountDeletionCodeScreen` (319) | | profile, groups | deletion request → blocked list → transfer ownership → emailed code confirmation |
| `NotificationHistoryScreen` | 942 | notifications | grouped by day, swipe read/unread, mark all, paging by cursor, "kept N days" |
| `NotificationPreferencesScreen` | 13 | via component | shared list component |
| `OnboardingScreen` | 202 | onboarding | steps in `ONBOARDING_STEP_ORDER`: skills, notifications, mobile number, photo; each step has Save and Skip |
| `CompletionScreen` | 274 | none | summary after submit; hardware back runs the primary action |
| `ForceUpdateScreen` | 87 | none | blocking; no dismiss; back swallowed; only action opens the validated Play Store URL |

## Cross-cutting behaviour
- Text comes from labels (`useT`); numbers and dates are formatted with local helpers (`utils/format*`).
- Lists and detail loads use `useResource` (per-section loading/error so one failed request never blanks a screen).
- Forms use `KeyboardAwareScreen` and `useFieldChain`.
- One correlation ID per logical action via `withCorrelationId()`.
- Create Game: tournament creation reuses the same wizard; venue selection uses `VenuePicker` (catalogue, `GET /venues`) with an Others entry; `places.ts` and device geolocation remain in the screen for the legacy free-text venue path.

## Drift and findings
- 🟡 MEDIUM `EventDetailScreen` (2,121 lines) and `CreateGameScreen` (1,578 lines) hold wizard state, validation, venue/geo logic and API orchestration inline; the Google Places and geolocation code is duplicated between them.
- 🟡 MEDIUM Team features are partial: team creation exists inside `CreateGroupScreen`, but no team list, detail, invite handling or tournament entry by team screen exists (see [notifications](notifications.md) for the `team_invite` consequence).
- 🟡 MEDIUM Tournament organiser actions (schedule generate/publish, results, committee, standings) are web-only; the mobile screen is read plus registration and invitations.
- 🟢 LOW `Event.is_organiser` is a stub set to false by the API mapper; screens compare `organiser_id` with the user id instead.
