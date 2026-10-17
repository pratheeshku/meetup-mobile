# As-built requirements (mobile): Screens

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MSCR-nn`. Owner assigns version and status.
Design: [design/screens.md](../design/screens.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MSCR-01 | Home shows a banner carousel, the next game, upcoming games and my groups, filterable by sport. | `HomeScreen`, `useSportFilter` |
| AB-MSCR-02 | Games shows All / Mine / Open scopes for games, and a Tournaments view. | `GamesScreen`, `gameLists.ts` |
| AB-MSCR-03 | A user can create a game in steps, with venue from the catalogue or an Others postal code, group sharing, email invites and a skill requirement, within server-provided limits. | `CreateGameScreen` |
| AB-MSCR-04 | The same wizard creates a tournament when the mode is switched. | `CreateGameScreen` |
| AB-MSCR-05 | A user can view a game, RSVP or withdraw, see participants, invite, edit and cancel (organiser). | `EventDetailScreen` |
| AB-MSCR-06 | A user can view a tournament, register or withdraw, and accept or decline an invitation; organisers can invite. | `TournamentDetailScreen`, `components/tournament` |
| AB-MSCR-07 | A user can create, edit, view and delete groups, invite members and manage members. | `screens/Group*` |
| AB-MSCR-08 | A user can view and edit their profile, photos, skill levels, mobile number and notification settings. | `ProfileScreen`, `EditProfileScreen`, `SettingsScreen` |
| AB-MSCR-09 | A user can delete their account after resolving blocking groups and confirming a code sent by email. | `AccountDeletion*`, `TransferGroupOwnership` |
| AB-MSCR-10 | A first-time user is offered skills, notifications, mobile number and photo steps, each skippable. | `OnboardingScreen` |
| AB-MSCR-11 | If the installed version is below the server minimum the user sees a blocking update screen with one action. | `ForceUpdateScreen` |
| AB-MSCR-12 | Buttons and permissions shown depend on server fields; the server decides. | all screens |

## Not evidenced in code (owner decision needed)
- Team list, team detail and team-based tournament entry on mobile.
- Tournament organiser actions (schedule, results, committee, standings) on mobile.
- Accessibility audit results (screen reader, font scaling).
- Offline behaviour.
