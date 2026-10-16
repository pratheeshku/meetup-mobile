# venue-map-blank report

Branch: `fix/create-game-optional-invites-map` (from `origin/main`).

## Files changed
- `src/components/venue/VenuePicker.tsx`, `src/components/venue/VenueDetailCard.tsx` — the Static Maps `<Image>` now has `onError`. On failure the existing map-pattern placeholder (with pin badge) renders instead of a blank box; the caption and everything else are untouched. The failure is tracked per URI, so a different venue or key tries the image again. Placeholder got `testID="venue-map-placeholder"`.
- `src/components/venue/logMapFailure.ts` — new. Logs one `console.warn` per session: `[venue-map] Static Maps image failed to load; showing placeholder`. The URL and the native error payload (which can echo the URL) are never logged.
- `src/components/venue/__tests__/VenueMapFallback.test.tsx` — new (4 tests, both components).
- URL format and key handling unchanged (same template string, just hoisted into a const); no map SDK added.
- No `onLoad` state was needed: only the failure path changes the UI.

## Tests (raw)
```
PASS src/components/venue/__tests__/VenueMapFallback.test.tsx
PASS src/components/venue/__tests__/VenuePicker.test.tsx
PASS src/components/venue/__tests__/VenueDetailCard.test.tsx
PASS src/components/venue/__tests__/OthersVenueModal.test.tsx
Tests: 26 passed, 26 total
```
Tests simulate `onError` and assert: image gone, placeholder present, caption still shown, one log only, API key absent from the log. Full suite unchanged vs `origin/main` (180 pre-existing failures in 15 stale suites). `tsc`, `eslint` clean.

## What the failing request returns
I could not use the real key (not available to me), so I reproduced with an invalid key from this container:
`GET https://maps.googleapis.com/maps/api/staticmap?...&key=INVALID` → `HTTP 403`, `content-type: text/plain`, body: `The Google Maps Platform server rejected your request. The provided API key is invalid.`
A real key without Maps Static API enabled, or with an incompatible restriction, returns a similar 403 text/plain body (not an image) — which React Native's `Image` renders as a blank box and reports via `onError`. I have not confirmed which of these applies to the production key.

## Owner action (not a code change)
In Google Cloud Console, for the key served by `/config/client`: enable **Maps Static API** on the project, and make sure the key restriction is compatible with a mobile app request. Android app restrictions (package name + SHA-1) only work if the request carries the app signature headers, which RN's `Image` does not send; an API restriction limited to other APIs, or an HTTP-referrer restriction, will also be rejected. Use an API restriction that includes Maps Static API and an application restriction that this request can satisfy (or a separate key for Static Maps).

## Deviations
- No screenshots: no emulator/device in this container.
- Both components duplicate the map markup (pre-existing); I did not refactor them into a shared component.
