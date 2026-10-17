# As-built requirements (mobile): Navigation

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MNAV-nn`. Owner assigns version and status.
Design: [design/navigation.md](../design/navigation.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MNAV-01 | Signed-out users see only Login, Register, Verify and Forgot Password; signed-in users see the tabbed app. | `RootNavigator.tsx` |
| AB-MNAV-02 | Tabs are Home, Groups, a raised Create button (menu: Game or Group), Games, Profile. | `CreateTabButton.tsx`, `tabIcons.tsx` |
| AB-MNAV-03 | Tournament creation is a mode inside Create Game, not a separate entry. | `navigation.md` amendment |
| AB-MNAV-04 | After a create, edit or cancel the app returns to the dashboard and shows a success message. | `goToDashboard.ts`, `showCompletion.ts` |
| AB-MNAV-05 | Tapping a notification opens the matching screen. | `notificationRouting.ts` |
| AB-MNAV-06 | First-run onboarding is shown above the app when the server requires it, once per user per session; any failure skips it. | `OnboardingOverlay.tsx`, `useOnboardingRequired` |
| AB-MNAV-07 | Completion summaries are held in memory only. | `showCompletion.ts` |

## Not evidenced in code (owner decision needed)
- URL-scheme and App Links deep linking (designed §3.9, not built).
- Team detail screen (needed by `team_invite` routing).
- Tablet / landscape layouts.
