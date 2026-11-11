#!/usr/bin/env bash
# Version guard for the production Android CI build (Task 3.3, AD-9 / OI-3).
#
# There is no Play API at this tier, so the git tags are the record of what was built:
#   android-prod-v<versionName>-<versionCode>
# Reads versionName / versionCode from android/version.properties (the only source),
# then fails if
#   - that exact tag already exists, or
#   - the committed versionCode is <= the highest versionCode in any android-prod-v* tag.
# Needs all tags locally (checkout with fetch-depth 0). Never edits anything.
#
# Output: a decision on stdout. If GUARD_OUTPUT is set, VERSION_NAME / VERSION_CODE /
# TAG lines are appended to that file (for $GITHUB_OUTPUT). If GITHUB_STEP_SUMMARY is
# set, the decision is appended to the run summary. VERSION_FILE overrides the path
# (tests only).
set -euo pipefail

VERSION_FILE="${VERSION_FILE:-android/version.properties}"
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-}"

say() {
  echo "$*"
  if [ -n "$SUMMARY_FILE" ]; then echo "$*" >> "$SUMMARY_FILE"; fi
}
fail() {
  say "- Guard decision: **FAIL** - $*"
  echo "::error::Version guard: $*" >&2
  exit 1
}

[ -f "$VERSION_FILE" ] || fail "$VERSION_FILE is missing"
name="$(sed -nE 's/^versionName=(.*)$/\1/p' "$VERSION_FILE" | head -1)"
code="$(sed -nE 's/^versionCode=(.*)$/\1/p' "$VERSION_FILE" | head -1)"
[ -n "$name" ] || fail "versionName not found in $VERSION_FILE"
[[ "$name" =~ ^[0-9A-Za-z][0-9A-Za-z._+-]*$ ]] || fail "versionName '$name' has characters that are not allowed in a tag"
[[ "$code" =~ ^[1-9][0-9]*$ ]] || fail "versionCode '$code' in $VERSION_FILE is not a positive integer"

tag="android-prod-v${name}-${code}"

highest=0
highest_tag=""
while IFS= read -r existing; do
  [ -n "$existing" ] || continue
  if [[ "$existing" =~ ^android-prod-v(.+)-([0-9]+)$ ]]; then
    existing_code=$((10#${BASH_REMATCH[2]}))
    if [ "$existing_code" -gt "$highest" ]; then
      highest="$existing_code"
      highest_tag="$existing"
    fi
  else
    echo "note: ignoring tag '$existing' (does not match android-prod-v<name>-<code>)"
  fi
done < <(git tag -l 'android-prod-v*')

say "- Committed version: ${name} (${code})"
say "- Tag to create after a verified build: ${tag}"
if [ -n "$highest_tag" ]; then
  say "- Highest versionCode in existing android-prod-v* tags: ${highest} (${highest_tag})"
else
  say "- Highest versionCode in existing android-prod-v* tags: none"
fi

if git rev-parse -q --verify "refs/tags/${tag}" > /dev/null; then
  fail "tag ${tag} already exists: this version was already built. Bump android/version.properties (architect assigns the number)."
fi
if [ "$code" -le "$highest" ]; then
  fail "versionCode ${code} is not above the highest released versionCode ${highest} (${highest_tag}). Bump android/version.properties."
fi

say "- Guard decision: **PASS** - ${code} is above ${highest} and ${tag} does not exist."
if [ -n "${GUARD_OUTPUT:-}" ]; then
  {
    echo "VERSION_NAME=${name}"
    echo "VERSION_CODE=${code}"
    echo "TAG=${tag}"
  } >> "$GUARD_OUTPUT"
fi
