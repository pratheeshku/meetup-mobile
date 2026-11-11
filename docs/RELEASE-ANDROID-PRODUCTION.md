# Release the production Android app (owner steps)

CI builds and signs the production bundle (AAB). You upload it in the Play Console by hand; there is no automatic upload. Workflow: `.github/workflows/android-production-release.yml` (manual, `main` only, environment `production`). Design: `DES-MEETUP-ADDENDUM-staging-pipeline` (AD-9, OI-3) in the backend repo.

## One-time setup
1. In GitHub, open Settings, Environments, `production` of this repository.
2. Add these four secrets (names only here; never paste values into issues, chats or files):
   - `ANDROID_KEYSTORE_B64` (the upload keystore, base64)
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_GOOGLE_SERVICES_JSON_B64` (the `google-services.json` that has clients for both `org.duckdns.meetups` and `org.duckdns.meetups.staging`, base64)
3. Optional: add `ANDROID_KEY_PASSWORD` if the key password differs from the keystore password. If you leave it out, the keystore password is used for both.
4. Check that the `production` environment still lists you as required reviewer and is limited to the `main` branch.

## Each release
1. The architect assigns the new `versionName` and `versionCode`. In a pull request, set them in `android/version.properties` (and the iOS values in `config/appConfig.json` if the iOS app ships too). The `versionCode` must be higher than the last one released.
2. Merge the pull request into `main`.
3. In GitHub, open Actions, `Android production release`, Run workflow, branch `main`.
4. Approve the run when GitHub asks the reviewer (you) to.
5. Wait for it to finish. The run summary shows the version, the guard decision, and the signing certificate fingerprint (SHA-256).
6. Download the artefact `android-production-<versionName>-<versionCode>` from the run page (kept 30 days) and unzip it to get `app-production-release.aab`.
7. Compare the certificate fingerprint in the run summary with the upload key fingerprint in the Play Console (App integrity, App signing, Upload key certificate). If they differ, stop and do not upload.
8. In the Play Console, create a release on the track you want (for example internal testing first), upload the `.aab`, and roll it out.
9. Promote to production users by hand in the Play Console when you are satisfied.

## Good to know
- The workflow creates the git tag `android-prod-v<versionName>-<versionCode>` only after the bundle is built, signed, verified and stored. A failed or cancelled run creates no tag.
- Running it again for a version that already has a tag fails on purpose. Ask the architect for the next `versionCode` instead of editing or deleting tags.
- The workflow never changes a version number by itself.
