# Implementation Report — replace react-native-camera with react-native-vision-camera

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED
- **Scope of this pass**: closes Known Gap #3 from `docs/reports/IMPL-DES-MEETUP-MOBILE-scaffold.md` §6 (`react-native-camera` unmaintained risk). Pure dependency swap — no QR scan screen, no camera permission handling, no feature logic added. R-061 (participant scans the organiser's displayed check-in code with their device camera, §3.7/§4.7) is the requirement this dependency ultimately serves, but it is **not** implemented in this pass.
- **Note on the task brief's own citation**: the brief cites "DES-MEETUP-MOBILE §4.9" for the QR scan flow; §4.9 is actually the Admin Module section. The correct sections are §3.7 (QR Display and Scan architecture decision) and §4.7 (QR Code Check-In screen design). Flagging this citation mismatch for the record; it did not affect this task, which touches no QR logic.

## 2. Traceability map

| Task brief step | Action taken | Files |
|---|---|---|
| 1. Uninstall `react-native-camera` | Done | `package.json`, `package-lock.json` |
| 2. Install `react-native-vision-camera` | Installed **pinned to `4.7.3`**, not the unpinned `latest` — see Deviations §1 | `package.json`, `package-lock.json` |
| 3. Install a QR/barcode scanner plugin, checking compatibility first | **Neither plugin installed** — VisionCamera v4 ships a built-in, platform-native code scanner (`useCodeScanner`); both named plugins were checked and found unnecessary or unsuitable — see Deviations §2 and the Compatibility Findings below | — |
| 4. `missingDimensionStrategy` in `android/app/build.gradle`, only if `react-native-camera` left it behind | Checked — nothing was left behind (`react-native-camera` was never natively wired into any Gradle file during the original scaffold; it existed only as an `npm`-level dependency). No change made. | — (verified only) |
| 5. Verify `src/notifications/fcm.ts` doesn't import from `react-native-camera` | Confirmed — it does not (never did) | — (verified only) |
| 6. Update any other file that imported from `react-native-camera` | None found — see §5 | — (verified only) |
| 7. `tsc --noEmit` | Passes, see §5 | — |

Also updated (not a numbered brief step, but required by the brief's "Remove all react-native-camera references" rule applied to living project documentation): `CLAUDE.md` and `AGENTS.md` Stack Gotchas — replaced the stale "react-native-camera is unmaintained" entry with the vision-camera/code-scanner compatibility note and a new note on the still-undeclared `CAMERA` manifest permission. The historical implementation reports (`docs/reports/IMPL-DES-MEETUP-MOBILE-{scaffold,env-config,firebase-android}.md`) still mention `react-native-camera` — left untouched deliberately, since they are point-in-time records of what was true when each was written, not living documentation; rewriting history in a prior report would misrepresent what that session actually did.

## 3. Proposed Assumptions

None — the compatibility findings below are evidence-based determinations, not assumptions requiring a conservative guess.

## 4. Deviations

1. **Pinned `react-native-vision-camera` to `4.7.3` instead of installing the unpinned `latest` (which the brief's literal `npm install react-native-vision-camera` command would resolve to).** Checked before installing: `npm view react-native-vision-camera@latest version` resolves to **5.2.3**, not v4. VisionCamera v5 introduces a new required architecture (`react-native-nitro-modules`, `react-native-nitro-image` as peer dependencies) — a materially bigger change than "replace the camera library" implies, and not what the brief's context section names ("VisionCamera v4") or what its Rules constrain to ("scaffold only, no QR implementation yet" — a major-version jump with a new native-module architecture is exactly the kind of thing that should be a deliberate, separate, architect-reviewed decision, not an incidental side effect of an unpinned install). Installed the newest stable v4 release, `4.7.3` (published 2026-08-20, same recency as v5.2.3 — the v4 line is still actively maintained in parallel), which satisfies the brief's stated intent exactly. This mirrors the same reasoning applied to the React Native version pin in the original scaffold report.
2. **No QR/barcode scanner plugin was installed at all — neither of the two named in the brief.** See Compatibility Findings below for the evidence. This is a deviation from brief step 3's literal instruction to install one of the two, but it is the more conservative, less-invasive reading available: it adds zero new dependencies (versus one), avoids a stale/incompatible package entirely, and avoids a mandatory peer dependency (`react-native-worklets-core`) for functionality the already-installed camera library provides natively. Recorded here explicitly for conformance review to ratify or override.

## 5. Compatibility findings — QR/barcode scanner plugin

Checked both plugins named in the brief against `react-native-vision-camera@4.7.3` before deciding:

**`vision-camera-code-scanner`** — **incompatible, confirmed stale**:
```
$ npm view vision-camera-code-scanner@latest peerDependencies time.modified
peerDependencies = { react: '*', 'react-native': '*', 'react-native-vision-camera': '>=2.9.4' }
time.modified = '2022-05-23T08:00:21.562Z'
```
Last published May 2022 (versions `0.1.6`/`0.2.0` only). Its peer constraint (`>=2.9.4`, no upper bound stated but the code itself targets VisionCamera v2's now-removed JS frame-processor-plugin API) predates the frame-processor and native code-scanner rewrites in VisionCamera v3/v4. Not usable.

**`@mgcrea/vision-camera-barcode-scanner`** — **compatible with v4, but unnecessary**:
```
$ npm view @mgcrea/vision-camera-barcode-scanner@latest peerDependencies time.modified
peerDependencies = {
  react: '*', 'react-native': '*',
  'react-native-vision-camera': '>=4.0.0-0',
  'react-native-worklets-core': '>=1.1.1-0'
}
time.modified = '2025-10-06T13:44:19.441Z'
```
Actively maintained and explicitly compatible with VisionCamera v4 — but requires `react-native-worklets-core` as a **mandatory** (non-optional) peer dependency, because it works via VisionCamera's JS frame-processor pipeline.

**Why neither was needed**: `react-native-vision-camera@4.7.3` itself ships a built-in, platform-native code scanner — confirmed directly in the installed package source, not from memory:
```
$ grep -rn "useCodeScanner\|CodeScanner" node_modules/react-native-vision-camera/src/index.ts
export * from './types/CodeScanner'
export * from './hooks/useCodeScanner'
```
`node_modules/react-native-vision-camera/src/types/CameraProps.ts` documents the `codeScanner` prop directly: *"A CodeScanner that can detect QR-Codes or Barcodes using platform-native APIs"* — with a usage example (`useCodeScanner({ codeTypes: ['qr', 'ean-13'], onCodeScanned })`, passed to `<Camera codeScanner={codeScanner} />`). `node_modules/react-native-vision-camera/src/hooks/useCodeScanner.ts` itself is plain React (`useCallback`/`useMemo`/`useRef` only) — no `react-native-reanimated` or `react-native-worklets-core` involved. This directly satisfies R-061 ("scans it with their device camera") without any extra native dependency, extra native linking surface, or the frame-processor/worklets pipeline neither scanner plugin's approach is actually required for. Installing either named plugin on top of this would be redundant, unjustified complexity against the design's own BP-12 principle (already invoked repeatedly elsewhere in DES-MEETUP-MOBILE.md, e.g. §2.4, §3.3).

## 6. Verification results

**No `react-native-camera` references remain in application code**:
```
$ grep -rln "react-native-camera" . 2>/dev/null | grep -v node_modules | grep -v package-lock.json
AGENTS.md
CLAUDE.md
docs/reports/IMPL-DES-MEETUP-MOBILE-firebase-android.md
docs/reports/IMPL-DES-MEETUP-MOBILE-env-config.md
docs/reports/IMPL-DES-MEETUP-MOBILE-scaffold.md
```
The five remaining hits are: `CLAUDE.md`/`AGENTS.md`, now describing the swap in past tense as living documentation (updated in this pass, see §2); and three historical Implementation Reports, deliberately left as accurate records of their own point in time (see §2). No `.ts`/`.tsx`/`.js`/`.gradle` source file references it (`package.json` itself no longer does either — see the diff below).

**`package.json` diff**:
```diff
-    "react-native-camera": "^4.2.1",
     "react-native-config": "^1.7.2",
     ...
-    "react-native-uuid": "^2.0.4"
+    "react-native-uuid": "^2.0.4",
+    "react-native-vision-camera": "^4.7.3"
```

**No Gradle traces left by `react-native-camera` to compensate for** (brief step 4's `missingDimensionStrategy`, conditionally not needed):
```
$ grep -n "missingDimensionStrategy\|react-native-camera\|camera" android/app/build.gradle android/build.gradle android/gradle.properties android/settings.gradle
(no output — nothing found)
```

**`fcm.ts` / other files never imported `react-native-camera`** (checked before *and* after the swap):
```
$ grep -rln "react-native-camera" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.gradle" --include="*.json" . | grep -v node_modules | grep -v package-lock.json
package.json   # (pre-swap result, for the record — only package.json referenced it, as a dependency entry, nowhere in src/)
```

**Dependency audit** — no peer conflicts, single React copy:
```
$ npm ls react-native-vision-camera
MeetupMobile@0.0.1 /Users/pratheesh/Developer/meetup-mobile
└── react-native-vision-camera@4.7.3

$ npm install --dry-run 2>&1 | grep -i "ERESOLVE\|peer dep"
(no output)
```

**Type-check** — clean:
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Lint** — clean:
```
$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

**Tests** (unaffected — no source file imports either camera library), run 3x for stability:
```
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
--- Run 3 ---
```

## 7. Known gaps / follow-ups

- `android.permission.CAMERA` is still not declared in `AndroidManifest.xml` — neither camera library bundles it in its own manifest (confirmed: `react-native-vision-camera`'s bundled `AndroidManifest.xml` is empty of permissions). Add it, with the pre-scan rationale flow (§3.7, R-062), when the actual QR-scan screen is built — same pattern already used for FCM's `POST_NOTIFICATIONS`.
- No native Android build (`assembleDebug`) was run in this pass beyond what was already verified in the prior Firebase report — no new native-linking-specific verification was performed for VisionCamera beyond the dependency-resolution and source-code checks in §5/§6, since no Android SDK is available in this environment (same pre-existing gap noted in all three prior reports).
- Carried forward unchanged: §3.3's retry/backoff and Circuit Breaker interceptors, deep-link routing (§3.9), and session silent-restore (R-016) are still not built.
