# As-built requirements (mobile): Notifications (device side)

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MNTF-nn`. Owner assigns version and status.
Design: [design/notifications.md](../design/notifications.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MNTF-01 | The app asks for notification permission after showing its own explanation once per install. | `pushRegistration.ts` |
| AB-MNTF-02 | When permitted, the device token is registered with the server once per token per session, re-registered on rotation, retried on foreground, and removed on sign-out. | `fcm.ts` |
| AB-MNTF-03 | The server sends data-only pushes; the app builds the visible notification locally from labels. | `eventNotificationHandler.ts`, `participantHandler.ts` |
| AB-MNTF-04 | While the app is open, a push shows an in-app banner and raises the unread badge instead of a system notification. | `notificationBannerStore.ts` |
| AB-MNTF-05 | A user can view history by day, mark items read or unread, mark all read, and page through older items. | `NotificationHistoryScreen` |
| AB-MNTF-06 | A user can switch each notification type on or off. | `NotificationPreferencesList` |
| AB-MNTF-07 | Every one of the 19 notification types routes to a screen. | `notificationRouting.ts` |
| AB-MNTF-08 | Tokens and notification content are never logged. | `fcm.ts` |

## Not evidenced in code (owner decision needed)
- Quiet hours or snooze.
- In-app action buttons beyond those defined for event notifications.
- Team invitation handling from a notification.
