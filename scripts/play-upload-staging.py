#!/usr/bin/env python3
"""Upload a signed staging AAB to the Google Play INTERNAL testing track.

Usage: play-upload-staging.py <aab-path> <service-account-json-path>

Google Play Developer API v3 edit flow: edits.insert -> bundles.upload ->
tracks.update (track internal, release status completed) -> edits.commit.
Fails loudly (non-zero exit) with the API error. Never prints credentials.
"""
import json
import sys

PACKAGE_NAME = "org.duckdns.meetups.staging"
TRACK = "internal"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]


def fail(message):
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def main(argv):
    if len(argv) != 3:
        fail("usage: play-upload-staging.py <aab-path> <service-account-json-path>")
    aab_path, credentials_path = argv[1], argv[2]

    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    try:
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path, scopes=SCOPES
        )
    except (OSError, ValueError) as error:
        # Only the exception type: its text could echo parts of the file.
        fail(f"could not load the service account credentials ({type(error).__name__})")

    service = build("androidpublisher", "v3", credentials=credentials, cache_discovery=False)
    edits = service.edits()
    try:
        edit_id = edits.insert(packageName=PACKAGE_NAME, body={}).execute()["id"]
        bundle = edits.bundles().upload(
            packageName=PACKAGE_NAME,
            editId=edit_id,
            media_body=MediaFileUpload(aab_path, mimetype="application/octet-stream", resumable=True),
        ).execute()
        version_code = int(bundle["versionCode"])
        edits.tracks().update(
            packageName=PACKAGE_NAME,
            editId=edit_id,
            track=TRACK,
            body={
                "track": TRACK,
                "releases": [{"versionCodes": [str(version_code)], "status": "completed"}],
            },
        ).execute()
        edits.commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
    except HttpError as error:
        try:
            detail = json.loads(error.content.decode("utf-8")).get("error", {})
            message = f"{detail.get('code', error.resp.status)} {detail.get('status', '')}: {detail.get('message', '')}"
        except (ValueError, AttributeError):
            message = f"HTTP {error.resp.status} {error.reason}"
        fail(f"Google Play API call failed: {message.strip()}")

    print(f"OK: uploaded versionCode {version_code} of {PACKAGE_NAME} to the {TRACK} track (completed).")


if __name__ == "__main__":
    main(sys.argv)
