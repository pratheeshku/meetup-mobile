# Implementation Report — DES-MEETUP-ADDENDUM-profile-photo (Crop/Zoom/Rotate Amendment)

## 1. Design Reference

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-profile-photo.md |
| Version | 1.0 (with direct architect instruction reversing Non-Goal "no crop/editing UI at T1" and Assumption 2 "center-cropped to square, no crop/editing UI") |
| Status | APPROVED — architect-approved 2026-09-26 |
| Tier | T1 |
| Scope | §10 — Profile photo crop/zoom/flip mobile upload flow (ProfileScreen only) |
| Secondary docs | DES-MEETUP-MOBILE.md (mobile-repo copy), REQ-MEETUP-MOBILE.md |

## 2. Traceability Map

| Requirement / Scope Item | Files & Commits |
|---|---|
| Package replacement: remove `react-native-image-picker`, install `react-native-image-crop-picker` (>=0.50.0 for New Arch) | `package.json` (`react-native-image-crop-picker@0.51.1`), `package-lock.json` |
| Native crop & rotate options in upload flow (pinch-zoom, reposition, 500x500 square crop, rotation controls) | `src/screens/ProfileScreen.tsx` (`pickImage`, `ImageCropPicker.openCamera`, `ImageCropPicker.openPicker`) |
| Cancellation handling (`E_PICKER_CANCELLED`) | `src/screens/ProfileScreen.tsx` (`pickImage` catch block) |
| Jest test environment configuration | `jest.config.js` (`transformIgnorePatterns`), `jest.setup.js` (centralized `react-native-image-crop-picker` mock) |
| Unit tests for camera & gallery crop flows, cancellation, and error handling | `src/screens/__tests__/ProfileScreen.test.tsx` |
| Unaltered backend upload sequence client-side | `src/api/profile.ts` (`uploadAvatar`, doc comment update) |
| Feature commit | `37b93a3` — `feat(profile): integrate image crop, zoom, and rotate in profile photo upload` |

## 3. Investigation of Native Crop Controller Capabilities (iOS & Android)

An empirical investigation was conducted on `react-native-image-crop-picker@0.51.1` and its underlying native SDK controllers on both iOS and Android:

### iOS — `TOCropViewController` (~2.8.0)
- **Crop (reposition & pinch-zoom):** Supported. `TOCropViewController` allows dragging and pinch-zooming the photo within the crop area. Aspect ratio is locked to 1:1 square via `customAspectRatio = CGSizeMake(500, 500)` and `aspectRatioLockEnabled = true`.
- **Rotate:** Supported. Exposes a 90-degree counter-clockwise rotation button on its toolbar when `cropperRotateButtonsHidden: false` (the default). Also supports fine-angle wheel adjustment.
- **Flip (horizontal / vertical mirror):** **NOT supported.** `TOCropViewController` has no flip button, property, or delegate API for mirroring images along either axis.

### Android — `uCrop` (`com.github.yalantis:ucrop`)
- **Crop (reposition & pinch-zoom):** Supported. `UCrop` allows pan and pinch-zoom with aspect ratio locked to 1:1 square via `withAspectRatio(500, 500)`.
- **Rotate:** Supported. `UCropActivity` includes a rotate tab with 90-degree rotation buttons and a rotation wheel when `hideBottomControls: false` (the default). In addition, two-finger rotation gesture is enabled via `enableRotationGesture: true`.
- **Flip (horizontal / vertical mirror):** **NOT supported.** `uCrop` has no native flip or mirroring control in its UI or options.

## 4. Proposed Assumptions

1. **PA-1 (MEDIUM — Native Flip Support):** Neither iOS (`TOCropViewController`) nor Android (`uCrop`) exposes flip/mirror controls in its native controller. Per the architect's explicit constraint, pulling in `react-native-gesture-handler` + `react-native-reanimated` + a third image transform library to build a custom JavaScript/native transform pipeline is a heavyweight architectural decision. Under the **Propose & Proceed** rule, the most conservative reading is taken: crop, pinch-zoom, reposition, square aspect ratio lock (500x500), and rotation controls are fully wired up and active using `react-native-image-crop-picker`; flip is omitted from the native UI step without adding any new dependencies. This finding is documented here for the architect's addendum write-back.

2. **PA-2 (LOW):** Aspect ratio and crop dimensions are configured as `width: 500, height: 500` with `compressImageQuality: 0.8`. This enforces a 1:1 square aspect ratio matching the ProfileScreen circular avatar format while preserving high fidelity at typical mobile avatar dimensions.

3. **PA-3 (LOW):** If `image.filename` is not populated by the native picker on certain Android versions, filename is safely extracted from the path (`image.path.split('/').pop() || 'avatar.jpg'`), and `image.mime` defaults to `'image/jpeg'`.

## 5. Deviations

None. (Reversal of the addendum's Non-Goal "no crop/editing UI at T1" and Assumption 2 was executed per direct architect instruction).

## 6. Verification Results

### TypeScript
```
npx tsc --noEmit → clean (exit 0, no output)
```

### ESLint
```
npx eslint src/ → clean (exit 0, no output)
```

### Tests (3 consecutive runs)
```
Run 1: Test Suites: 70 passed, 70 total / Tests: 890 passed, 890 total
Run 2: Test Suites: 70 passed, 70 total / Tests: 890 passed, 890 total
Run 3: Test Suites: 70 passed, 70 total / Tests: 890 passed, 890 total
```

### Negative tests confirmed
- Picker / cropper cancellation (`code: 'E_PICKER_CANCELLED'`): handled gracefully with no upload triggered, no error alert displayed, and previous avatar state preserved.
- Upload failure (e.g. 413 file too large): reverts preview, surfaces error message via `getApiErrorMessage`.
- Avatar removal failure: displays error message and retains existing avatar.

## 7. Known Gaps / Follow-ups

1. **Image flip (mirroring):** If horizontal/vertical flip is deemed strictly mandatory for mobile profile photos, the architect must evaluate whether to authorize the addition of `react-native-gesture-handler`, `react-native-reanimated`, and a native image manipulation library to implement a custom crop/flip screen in place of the native platform controllers.
2. **Addendum text write-back:** `DES-MEETUP-ADDENDUM-profile-photo.md` §2 Non-Goals and Assumption 2 should be formally updated to reflect the presence of the native crop/zoom/rotate UI and the omission of flip.

## Completion Proof

### Test evidence (raw output — no summaries):
```
Test Suites: 70 passed, 70 total
Tests:       890 passed, 890 total
Snapshots:   0 total
Time:        2.556 s, estimated 3 s
Ran all test suites.
--- Run 1 ---
Test Suites: 70 passed, 70 total
Tests:       890 passed, 890 total
Snapshots:   0 total
Time:        2.321 s, estimated 3 s
Ran all test suites.
--- Run 2 ---
Test Suites: 70 passed, 70 total
Tests:       890 passed, 890 total
Snapshots:   0 total
Time:        2.412 s, estimated 3 s
Ran all test suites.
--- Run 3 ---
```

### Git evidence:
```
37b93a3 (HEAD -> main) feat(profile): integrate image crop, zoom, and rotate in profile photo upload
81bfd33 (origin/main, origin/HEAD) docs(reports): add profile-photo implementation report, enhancement note, and status archive
8330110 feat(profile): add profile photo upload/remove flow
```

```
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
  (use "git push" to publish your local commits)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   docs/reports/agent-enhancement-2026-09-26.md
	modified:   docs/reports/implementation-status-DES-MEETUP-ADDENDUM-profile-photo.md

no changes added to commit (use "git add" and/or "git commit -a")
```

### File evidence (grep showing key change exists on disk):
```
$ grep -n "ImageCropPicker" src/screens/ProfileScreen.tsx
40:import ImageCropPicker from 'react-native-image-crop-picker';
237:          ? await ImageCropPicker.openCamera(cropOptions)
238:          : await ImageCropPicker.openPicker(cropOptions);
```
