# As-built design: mobile navigation (`src/navigation`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/navigation.md](../requirements/navigation.md) · [notifications](notifications.md) (routing) · `docs/DES-MEETUP-ADDENDUM-dashboard.md`, `docs/INDEX.md` "Design reference (UI)"

## Structure
A single root switch on `AuthContext.user`:
- **Auth stack**: Login, Register, Verify, ForgotPassword, Completion.
- **App**: root native stack `Tabs` + `Completion` (modal-like summary), with `OnboardingOverlay` rendered above the `NavigationContainer` when the server says first-run is required.
- **Tabs** (route names): `Home`, `Groups`, `Create` (a slot for the raised "+" button, never a destination), `Tournaments` (labelled "Games"; its screen has a Games | Tournaments switch), `Profile`.
- **Home stack**: EventsList (HomeScreen), EventDetail, CreateGame, NotificationHistory. **Groups stack**: GroupsList, GroupDetail, EditGroup, InviteMembers, CreateGroup, TournamentTeams. **Tournaments stack**: TournamentsList (GamesScreen), TournamentDetail. **Profile stack**: ProfileHome, EditProfile, EditSkillLevels, Settings, NotificationPreferences, AccountDeletionBlocked, TransferGroupOwnership, AccountDeletionCode.

## Files
| File | Lines | Role |
|---|---|---|
| `RootNavigator.tsx` | 537 | stacks, tabs, container, ref attachment, notification tap wiring |
| `types.ts` | 120 | param lists |
| `CreateTabButton.tsx` / `CreateMenu.tsx` | 132 / 119 | raised "+" and its Game / Group menu |
| `tabIcons.tsx` | 66 | tab icons and label keys |
| `showCompletion.ts` | 285 | in-memory completion summary store (never persisted or logged); `account_deleted` arms a one-shot handoff to the Auth stack |
| `goToDashboard.ts` | 24 | post-success navigation to the dashboard with a refresh key |
| `groupCreateDraft.ts` | 29 | in-memory summary of a just-created group for step 2 |
| `OnboardingOverlay.tsx` | 24 | first-run overlay host (fail-open, once per user per session) |

## Behaviour
- Create flow: "+" opens the Game / Group menu; tournament creation is a toggle inside Create Game (amendment of 2026-09-22), so there is no separate Create Tournament entry.
- After a successful create/edit/cancel the app returns to the Home dashboard with `pop: true` and shows a success message.
- Notification taps navigate through a root `navigationRef` using `{tab, screen, params}` targets from `notificationRouting.ts`.
- Full URL-scheme / App Links deep linking (§3.9 of the design) is not part of this code: no `linking` config is passed to `NavigationContainer`. Share links are plain https links opened by the OS browser or Play Store.

## Drift and findings
- 🟡 MEDIUM Deep linking (§3.9) is designed but not built; `shuttlr:` and `meetup:` schemes appear only in a link-allow check in `NotificationHistoryScreen`.
- 🟡 MEDIUM `TournamentTeams` is a "coming soon" placeholder behind the drawer menu (`WipStrip`), while the backend has full team CRUD.
- 🟢 LOW The route named `Tournaments` is shown as "Games"; kept for notification routing compatibility (documented in `tabIcons.tsx`).
