# meetup-mobile

Meetup — Mobile app for creating and joining sports events, groups, and
tournaments. Built with React Native (bare workflow, Android). Consumes
the Meetup platform API.

Governing design: `docs/DES-MEETUP-MOBILE.md` (T1, APPROVED). Requirements
baseline: `docs/REQ-MEETUP-MOBILE.md` (APPROVED).

This is a React Native project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Release build (signed AAB for Google Play)

App identity: `applicationId` `org.duckdns.meetups`, label **Shuttlr**,
`versionName` in `android/version.properties`, `targetSdk` 36
(`android/build.gradle`). The API/web host is defined once in
`config/env.ts` (`ENV.API_BASE_URL`, default `https://meetups.duckdns.org`);
override at build time with `API_BASE_URL` in the gitignored root `.env`.

**One command:**

```sh
npm run build:aab
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.

The script (`scripts/build-release-aab.sh`):
1. checks the signing file exists and that `android/app/google-services.json`
   has a client for the `applicationId`;
2. increments `versionCode` in `android/version.properties` (strictly
   increasing; never reused even if the build later fails) — **commit the
   bumped file after each release build**;
3. runs `./gradlew bundleRelease`;
4. verifies the AAB is signed by the Shuttlr upload key.

**Signing.** The upload keystore lives outside the repo at
`~/keys/shuttlr/upload-keystore.jks` (alias `shuttlr-upload`), with its
credentials in `~/keys/shuttlr/key.properties` (mode 600). Gradle finds it
through the `KEY_PROPERTIES_FILE` environment variable, which the script sets
to that path by default (override by exporting `KEY_PROPERTIES_FILE`). CI can
supply the same file contents from secrets. Back up `~/keys/shuttlr/`; keystore
patterns (`*.jks`, `*.keystore`, `*.p12`, `key.properties`) are gitignored.
Do not run `./gradlew bundleRelease` directly without `KEY_PROPERTIES_FILE`
set — it would fall back to `android/key.properties`, which may hold another
app's key.

**Firebase.** `android/app/google-services.json` (gitignored) must contain a
client for `org.duckdns.meetups`: register that package (plus the upload-key
SHA-1/SHA-256 from `keytool -list -v -keystore ~/keys/shuttlr/upload-keystore.jks`,
and later the Play App Signing key's) in the Firebase console, download the new
file and place it there.

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
