#!/usr/bin/env bash
# Builds the signed Shuttlr release AAB.
#
#   npm run build:aab
#
# Steps: preflight (signing file, Firebase config matches applicationId) ->
# bump versionCode in android/version.properties -> ./gradlew bundleRelease ->
# verify the AAB is signed by the Shuttlr upload key. Never prints credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Signing credentials live outside the repo (see README "Release build").
export KEY_PROPERTIES_FILE="${KEY_PROPERTIES_FILE:-$HOME/keys/shuttlr/key.properties}"
VERSION_FILE="android/version.properties"
GRADLE_FILE="android/app/build.gradle"
GOOGLE_SERVICES="android/app/google-services.json"
AAB="android/app/build/outputs/bundle/release/app-release.aab"

fail() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$KEY_PROPERTIES_FILE" ] || fail "signing file not found: $KEY_PROPERTIES_FILE (set KEY_PROPERTIES_FILE or create ~/keys/shuttlr/key.properties)"

if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null)" || fail "JDK 17 not found and JAVA_HOME unset"
  export JAVA_HOME
fi

APPLICATION_ID="$(sed -nE 's/^[[:space:]]*applicationId[[:space:]]+"([^"]+)".*/\1/p' "$GRADLE_FILE" | head -1)"
[ -n "$APPLICATION_ID" ] || fail "could not read applicationId from $GRADLE_FILE"

# Preflight: the Google Services plugin requires a client for this applicationId.
[ -f "$GOOGLE_SERVICES" ] || fail "$GOOGLE_SERVICES is missing"
python3 - "$GOOGLE_SERVICES" "$APPLICATION_ID" <<'PY' || fail "$GOOGLE_SERVICES has no client for $APPLICATION_ID - register that package in the Firebase console and replace the file (see README)"
import json, sys
path, app_id = sys.argv[1], sys.argv[2]
clients = json.load(open(path)).get("client", [])
sys.exit(0 if any(c["client_info"]["android_client_info"]["package_name"] == app_id for c in clients) else 1)
PY

# Bump versionCode (strictly increasing; never reused, even if the build fails).
CURRENT="$(sed -nE 's/^versionCode=([0-9]+)$/\1/p' "$VERSION_FILE")"
[ -n "$CURRENT" ] || fail "versionCode not found in $VERSION_FILE"
NEXT=$((CURRENT + 1))
sed -E "s/^versionCode=[0-9]+$/versionCode=$NEXT/" "$VERSION_FILE" > "$VERSION_FILE.tmp" && mv "$VERSION_FILE.tmp" "$VERSION_FILE"
echo "versionCode: $CURRENT -> $NEXT"

(cd android && ./gradlew bundleRelease)

[ -f "$AAB" ] || fail "AAB not produced at $AAB"

# Verify the AAB is signed with the Shuttlr upload key (not debug / another app's key).
STORE_FILE="$(sed -nE 's/^storeFile=(.*)$/\1/p' "$KEY_PROPERTIES_FILE")"
KEY_ALIAS="$(sed -nE 's/^keyAlias=(.*)$/\1/p' "$KEY_PROPERTIES_FILE")"
EXPECTED="$(keytool -list -v -keystore "$STORE_FILE" -alias "$KEY_ALIAS" \
  -storepass:file <(sed -nE 's/^storePassword=(.*)$/\1/p' "$KEY_PROPERTIES_FILE") 2>/dev/null \
  | sed -nE 's/^[[:space:]]*SHA256: (.*)$/\1/p' | head -1)"
ACTUAL="$(keytool -printcert -jarfile "$AAB" 2>/dev/null | sed -nE 's/^[[:space:]]*SHA256: (.*)$/\1/p' | head -1)"
[ -n "$EXPECTED" ] && [ "$EXPECTED" = "$ACTUAL" ] || fail "AAB signer SHA-256 does not match the upload key (expected '$EXPECTED', got '$ACTUAL')"

echo "OK: $AAB"
echo "applicationId=$APPLICATION_ID versionCode=$NEXT signer SHA-256=$ACTUAL"
