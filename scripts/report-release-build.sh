#!/usr/bin/env bash
# Records a release build as the pending "latest build" for one platform in one environment
# (DES-MEETUP-ADDENDUM-app-update-prompt AD-4, AD-11, section 4.5; backend contract POST /app/release-build).
#
# Usage (GitHub Actions only): scripts/report-release-build.sh <android|ios> <build number> <base URL>
#   base URL: https://meetupstg.duckdns.org (staging) or https://meetupaws.duckdns.org (production).
#
# Identity: the run's GitHub OIDC ID token with audience exactly <base URL>. The job needs
# `permissions: id-token: write` and `environment: staging` or `production`; the server checks the repository,
# the branch (main) and the environment. No stored secret is used.
#
# Never fails the build (AD-4): every outcome, including a refusal or a network error, is written to the run summary
# and the script exits 0. The token is never printed.
set -uo pipefail

platform="${1:-}"
build="${2:-}"
base_url="${3:-}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

report() {
  {
    echo "### Latest build for the update prompt ($platform)"
    for line in "$@"; do
      echo "- $line"
    done
  } >> "$summary"
}

case "$platform" in
  android | ios) ;;
  *)
    report "Not written: unknown platform '$platform'. Enter the value in Admin > Config > App versions."
    exit 0
    ;;
esac
if ! [[ "$build" =~ ^[1-9][0-9]*$ ]]; then
  report "Not written: build number '$build' is not a whole number of 1 or more. Enter the value in Admin."
  exit 0
fi
case "$base_url" in
  https://meetupstg.duckdns.org | https://meetupaws.duckdns.org) ;;
  *)
    report "Not written: '$base_url' is not a known environment. Enter the value in Admin."
    exit 0
    ;;
esac

if [ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ] || [ -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]; then
  report "Not written: no OIDC token available (the job needs permissions id-token: write). Enter build $build in Admin."
  exit 0
fi

audience="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$base_url")"
token_json="$(curl --silent --show-error --fail --max-time 30 \
  -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=$audience" 2>/dev/null)" || token_json=""
id_token="$(printf '%s' "$token_json" | python3 -c 'import json, sys
try:
    print(json.load(sys.stdin).get("value", ""))
except Exception:
    print("")' 2>/dev/null)"
if [ -z "$id_token" ]; then
  report "Not written: GitHub did not issue an OIDC token. Enter build $build in Admin."
  exit 0
fi
echo "::add-mask::$id_token"

body="$(printf '{"platform": "%s", "build": %s}' "$platform" "$build")"
response_file="$(mktemp "${RUNNER_TEMP:-/tmp}/release-build.XXXXXX")"
status="$(curl --silent --show-error --max-time 30 \
  -o "$response_file" -w '%{http_code}' \
  -X POST "$base_url/app/release-build" \
  -H "Authorization: Bearer $id_token" \
  -H 'Content-Type: application/json' \
  --data "$body" 2>/dev/null)" || status="000"

if [ "$status" = "200" ]; then
  mapfile -t lines < <(python3 - "$response_file" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("Answer: 200 but the body could not be read.")
    sys.exit(0)
outcome = data.get("outcome")
print(f"Build sent: {data.get('build')}")
print(f"Outcome: {outcome}" + (" (not above the current effective or pending value; nothing changed)" if outcome == "ignored" else ""))
print(f"Effective latest build: {data.get('latest_build')}")
print(f"Pending latest build: {data.get('pending_latest_build')}")
print(f"Takes effect at (UTC): {data.get('effective_at')}")
PY
  )
  report "Environment: $base_url" "${lines[@]}"
else
  case "$status" in
    401) reason="token missing, invalid or expired" ;;
    403) reason="wrong repository, branch or environment" ;;
    422) reason="request body refused" ;;
    503) reason="the server could not fetch GitHub's signing keys" ;;
    000) reason="no answer (network error or timeout)" ;;
    *) reason="unexpected answer" ;;
  esac
  report "Environment: $base_url" "Not written: HTTP $status, $reason. Enter build $build in Admin > Config > App versions."
fi
rm -f "$response_file"
exit 0
