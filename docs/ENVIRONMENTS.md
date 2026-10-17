# Environments
Paths, hosts and commands only. No secrets, keys or passwords here. Prefix every command you give with the machine name and `cd <path> && pwd`.

## MacBook (Apple Silicon): where mobile work happens
- Repo: `~/Developer/meetup-mobile`. Backend repo is separate: `~/meetup` (on the AWS host, not on the Mac).
- Needs Node `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25` (react-native 0.86.3), Android SDK for Android runs, Xcode for iOS.
- Disk is nearly full: do not create clones or folders unless essential.
- Release signing: `android/key.properties` is local only and never committed.
- API target: set once in `config/env.ts` (`ENV.API_BASE_URL`). Leave `API_BASE_URL` in `.env` unset unless overriding. Production is https://meetupaws.duckdns.org.

## CI (GitHub Actions, `.github/workflows/`)
- `ios-ci.yml`, `ios-testflight.yml`, `label-scan.yml`.

## Backend environments
- The API runs on the AWS host described in `~/meetup/docs/ENVIRONMENTS.md`. Mobile builds, including Play Console test releases, point at that prod URL. There is no separate staging server.

## Rules
- Release builds: `npm run build:aab` bumps `versionCode` every run. Commit the bump immediately, or build with `SKIP_VERSION_BUMP=1`.
- Verify backend behaviour with curl against the public URL, not localhost.
