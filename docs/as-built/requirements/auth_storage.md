# As-built requirements (mobile): Authentication and token storage

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MAUTH-nn`. Owner assigns version and status.
Design: [design/auth_storage.md](../design/auth_storage.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MAUTH-01 | A user can register with email, verify the email, sign in, resend verification and request a password reset. | `emailAuth.ts` |
| AB-MAUTH-02 | A user can sign in with Google (Android, iOS) or Apple (iOS), sending the current terms version. | `googleAuth.ts`, `appleAuth.ts` |
| AB-MAUTH-03 | The access token is kept in Keychain with an in-memory cache; the refresh token is never visible to app code. | `storage/tokens.ts` |
| AB-MAUTH-04 | On launch or resume the app restores the session; only a definitive rejection signs the user out, and transient failures show a retry state. | `sessionRestore.ts`, `AuthContext.tsx` |
| AB-MAUTH-05 | When the API reports the session expired the user is returned to the sign-in screens. | `auth-expired` event |
| AB-MAUTH-06 | Sign-out calls the server, clears tokens and cookies, and removes the device push token. | `AuthContext.tsx` |
| AB-MAUTH-07 | Passwords, codes and tokens are never logged or stored. | `emailAuth.ts`, `logSafeError.ts` |
| AB-MAUTH-08 | Auth failure messages are generic. | `messages.ts` |
| AB-MAUTH-09 | Android backups are disabled for the app. | `AndroidManifest.xml` allowBackup=false |

## Not evidenced in code (owner decision needed)
- Biometric or device-lock gating of the stored token.
- Certificate pinning.
- Sign-in on devices without Play services (Google).
