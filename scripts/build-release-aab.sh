#!/usr/bin/env bash
# Builds the signed Shuttlr release AAB for one flavor (default: production).
#
#   npm run build:aab                      # production
#   SKIP_VERSION_BUMP=1 npm run build:aab
#   ./scripts/build-release-aab.sh --no-bump
#   npm run build:aab:staging              # staging; never touches android/version.properties
#   STAGING_VERSION_CODE=123 npm run build:aab:staging   # optional staging versionCode override
#
# Steps: preflight (signing file, Firebase config has a client for the flavor's applicationId) ->
# production only: bump versionCode in android/version.properties (unless SKIP_VERSION_BUMP=1 or --no-bump) ->
# ./gradlew bundle<Flavor>Release -> verify the AAB is signed by the Shuttlr upload key. Never prints credentials.
set -euo pipefail

SKIP_VERSION_BUMP="${SKIP_VERSION_BUMP:-0}"
FLAVOR="production"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-bump|--skip-version-bump)
      SKIP_VERSION_BUMP=1
      ;;
    --flavor)
      [ "$#" -ge 2 ] || { echo "ERROR: --flavor needs a value (production|staging)" >&2; exit 1; }
      FLAVOR="$2"
      shift
      ;;
    --flavor=*)
      FLAVOR="${1#--flavor=}"
      ;;
  esac
  shift
done
case "$FLAVOR" in
  production) FLAVOR_CAP="Production" ;;
  staging)    FLAVOR_CAP="Staging" ;;
  *) echo "ERROR: unknown flavor '$FLAVOR' (expected production or staging)" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Signing credentials live outside the repo (see README "Release build").
export KEY_PROPERTIES_FILE="${KEY_PROPERTIES_FILE:-$HOME/keys/shuttlr/key.properties}"
VERSION_FILE="android/version.properties"
GRADLE_FILE="android/app/build.gradle"
GOOGLE_SERVICES="android/app/google-services.json"
APP_CONFIG="config/appConfig.json"
AAB="android/app/build/outputs/bundle/${FLAVOR}Release/app-${FLAVOR}-release.aab"

fail() { echo "ERROR: $*" >&2; exit 1; }

# The versionCode override is staging-only (also enforced in android/app/build.gradle).
if [ "$FLAVOR" = "production" ] && [ -n "${STAGING_VERSION_CODE:-}" ]; then
  fail "STAGING_VERSION_CODE is set but this is a production build; production versionCode comes only from $VERSION_FILE. Unset it or use build:aab:staging."
fi

[ -f "$KEY_PROPERTIES_FILE" ] || fail "signing file not found: $KEY_PROPERTIES_FILE (set KEY_PROPERTIES_FILE or create ~/keys/shuttlr/key.properties)"

if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null)" || fail "JDK 17 not found and JAVA_HOME unset"
  export JAVA_HOME
fi

if [ "$FLAVOR" = "staging" ]; then
  APPLICATION_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["environments"]["staging"]["applicationId"])' "$APP_CONFIG")"
  [ -n "$APPLICATION_ID" ] || fail "could not read environments.staging.applicationId from $APP_CONFIG"
else
  APPLICATION_ID="$(sed -nE 's/^[[:space:]]*applicationId[[:space:]]+"([^"]+)".*/\1/p' "$GRADLE_FILE" | head -1)"
  [ -n "$APPLICATION_ID" ] || fail "could not read applicationId from $GRADLE_FILE"
fi

# Preflight: the Google Services plugin requires a client for this flavor's applicationId
# (the single google-services.json holds the clients of both flavors).
[ -f "$GOOGLE_SERVICES" ] || fail "$GOOGLE_SERVICES is missing"
python3 - "$GOOGLE_SERVICES" "$APPLICATION_ID" <<'PY' || fail "$GOOGLE_SERVICES has no client for $APPLICATION_ID - register that package in the Firebase console and replace the file (see README)"
import json, sys
path, app_id = sys.argv[1], sys.argv[2]
clients = json.load(open(path)).get("client", [])
sys.exit(0 if any(c["client_info"]["android_client_info"]["package_name"] == app_id for c in clients) else 1)
PY

# Bump versionCode (strictly increasing; never reused, even if the build fails),
# unless SKIP_VERSION_BUMP=1 or --no-bump was specified to preserve a manual pre-set.
# Staging never bumps or edits the version file.
CURRENT="$(sed -nE 's/^versionCode=([0-9]+)$/\1/p' "$VERSION_FILE")"
[ -n "$CURRENT" ] || fail "versionCode not found in $VERSION_FILE"

if [ "$FLAVOR" = "staging" ]; then
  NEXT="${STAGING_VERSION_CODE:-$CURRENT}"
  echo "versionCode: $NEXT (staging; $VERSION_FILE not modified)"
elif [ "$SKIP_VERSION_BUMP" = "1" ] || [ "$SKIP_VERSION_BUMP" = "true" ]; then
  NEXT="$CURRENT"
  echo "versionCode: preserved at $NEXT (SKIP_VERSION_BUMP enabled)"
else
  NEXT=$((CURRENT + 1))
  sed -E "s/^versionCode=[0-9]+$/versionCode=$NEXT/" "$VERSION_FILE" > "$VERSION_FILE.tmp" && mv "$VERSION_FILE.tmp" "$VERSION_FILE"
  echo "versionCode: $CURRENT -> $NEXT"
fi

(cd android && ./gradlew "bundle${FLAVOR_CAP}Release")

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
echo "flavor=$FLAVOR applicationId=$APPLICATION_ID versionCode=$NEXT signer SHA-256=$ACTUAL"
