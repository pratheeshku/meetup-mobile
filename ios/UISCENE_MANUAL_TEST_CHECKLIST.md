# UIScene lifecycle: manual test checklist (needs a Mac)

Run on **both** an Xcode 26 build and an Xcode 27 build (iOS 27 simulator, plus a real iPhone if possible).
The Xcode 27 build must launch without `EXC_BREAKPOINT` in `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`.
The target family is iPhone only (`TARGETED_DEVICE_FAMILY = 1`), so there is no iPad pass.

| # | Test | Expected |
|---|------|----------|
| 1 | Cold start (app killed) | Launch screen, then the app; no crash; no blank/black window |
| 2 | Log in (email and Google/Apple) | Login completes; Google/Apple sheet returns to the app |
| 3 | Background, wait, foreground | App resumes where it was; no white flash; session still valid |
| 4 | Push permission and token | Settings > Notifications on; device registers (backend shows the APNs/FCM token) |
| 5 | Push tap, app killed (cold) | App launches and opens the screen the notification points to |
| 6 | Push tap, app in background (warm) | App comes forward on the right screen |
| 7 | Push while in foreground | In-app banner shows; tapping it opens the right screen |
| 8 | Local notification (notify-kit) tap, cold and warm | Opens the right screen |
| 9 | Shared game link: tap while app is running, then with app killed | Opens in the browser/app as before (the app has no Associated Domains today, so a link normally opens Safari); no crash |
| 10 | Profile photo: choose from library and take photo | The picker presents (it uses `UIApplication.shared.delegate.window`, which SceneDelegate sets) |
| 11 | QR scan screen | Camera permission prompt, camera shows |
| 12 | Settings: version line | "Version x.y.z (build)" shows; long-press copies the five-line support text; "Copied" toast |
| 13 | Rotate / lock screen | iPhone is portrait only: stays portrait; lock and unlock keeps state |
| 14 | Alerts and modals (delete-account confirm, date picker, share sheet) | Present centred, not in a corner |
| 15 | Debug build only: shake menu and LogBox | Open and dismiss without a crash |

Record the Xcode version, iOS version and device for each pass. The Xcode pin in
`.github/workflows/ios-testflight.yml` may be removed only after row 1 to 12 pass on an Xcode 27 build.
