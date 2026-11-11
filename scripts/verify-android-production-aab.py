#!/usr/bin/env python3
"""Verify a signed PRODUCTION Android App Bundle (Task 3.3, AD-9).

Usage: verify-android-production-aab.py <aab> <expected-version-code> <expected-version-name> [google-services.json]

Fails (exit 1) unless:
  - the AAB exists and is non-empty;
  - the base manifest package is org.duckdns.meetups (not the staging id);
  - the manifest versionCode / versionName equal the committed values;
  - the manifest and compiled resources contain no staging package id, no staging app
    name, and (when google-services.json is given) none of the staging Firebase client's
    values that differ from the production client's.
Only the manifest and resources.pb are scanned for staging text: the JS bundle contains
config/appConfig.json, which legitimately lists the staging id. Never prints values read
from google-services.json (only counts).

The manifest is aapt2's protobuf XML (Resources.proto XmlNode); a minimal decoder is
included so no extra tool has to be installed.
"""
import json
import os
import sys
import zipfile

PRODUCTION_ID = "org.duckdns.meetups"
STAGING_ID = "org.duckdns.meetups.staging"
STAGING_NAME = "GameOn SG Staging"
MANIFEST = "base/manifest/AndroidManifest.xml"
RESOURCES = "base/resources.pb"


class Failure(Exception):
    pass


def varint(buf, pos):
    result = shift = 0
    while True:
        if pos >= len(buf):
            raise Failure("truncated protobuf data")
        byte = buf[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, pos
        shift += 7
        if shift > 70:
            raise Failure("bad varint")


def fields(buf):
    """Yield (field_number, wire_type, value) for one protobuf message."""
    pos = 0
    while pos < len(buf):
        key, pos = varint(buf, pos)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, pos = varint(buf, pos)
        elif wire == 2:
            length, pos = varint(buf, pos)
            if pos + length > len(buf):
                raise Failure("truncated protobuf field")
            value, pos = buf[pos:pos + length], pos + length
        elif wire == 1:
            value, pos = buf[pos:pos + 8], pos + 8
        elif wire == 5:
            value, pos = buf[pos:pos + 4], pos + 4
        else:
            raise Failure(f"unsupported wire type {wire}")
        yield number, wire, value


def attribute_value(attr_bytes):
    name = value = None
    prim = None
    for number, wire, data in fields(attr_bytes):
        if number == 2 and wire == 2:
            name = data.decode("utf-8", "replace")
        elif number == 3 and wire == 2:
            value = data.decode("utf-8", "replace")
        elif number == 6 and wire == 2:  # compiled_item (Item)
            for item_no, item_wire, item_data in fields(data):
                if item_no == 7 and item_wire == 2:  # prim
                    for prim_no, prim_wire, prim_data in fields(item_data):
                        if prim_no in (6, 7) and prim_wire == 0:  # int decimal / hex
                            prim = prim_data
    if (value is None or value == "") and prim is not None:
        value = str(prim)
    return name, value


def manifest_attributes(manifest_bytes):
    """Attributes of the root <manifest> element as {name: value}."""
    for number, wire, data in fields(manifest_bytes):
        if number == 1 and wire == 2:  # XmlNode.element
            element_name = None
            attrs = {}
            for el_no, el_wire, el_data in fields(data):
                if el_no == 3 and el_wire == 2:
                    element_name = el_data.decode("utf-8", "replace")
                elif el_no == 4 and el_wire == 2:
                    name, value = attribute_value(el_data)
                    if name:
                        attrs[name] = value
            if element_name != "manifest":
                raise Failure(f"root element is '{element_name}', expected 'manifest'")
            return attrs
    raise Failure("no root element in the manifest")


def google_services_staging_only_values(path):
    data = json.load(open(path))
    def values_for(package):
        out = set()
        for client in data.get("client", []):
            if client["client_info"]["android_client_info"]["package_name"] == package:
                if client["client_info"].get("mobilesdk_app_id"):
                    out.add(client["client_info"]["mobilesdk_app_id"])
                for key in client.get("api_key", []):
                    if key.get("current_key"):
                        out.add(key["current_key"])
        return out
    return values_for(STAGING_ID) - values_for(PRODUCTION_ID)


def verify(aab, version_code, version_name, google_services=None):
    if not os.path.isfile(aab):
        raise Failure(f"AAB not found: {aab}")
    if os.path.getsize(aab) == 0:
        raise Failure(f"AAB is empty: {aab}")
    try:
        archive = zipfile.ZipFile(aab)
    except zipfile.BadZipFile:
        raise Failure("the AAB is not a valid zip archive")
    with archive:
        names = set(archive.namelist())
        for needed in (MANIFEST, RESOURCES):
            if needed not in names:
                raise Failure(f"{needed} is missing from the AAB")
        manifest = archive.read(MANIFEST)
        resources = archive.read(RESOURCES)

    attrs = manifest_attributes(manifest)
    package = attrs.get("package")
    if package != PRODUCTION_ID:
        raise Failure(f"manifest package is '{package}', expected '{PRODUCTION_ID}'")
    if attrs.get("versionCode") != str(version_code):
        raise Failure(f"manifest versionCode is '{attrs.get('versionCode')}', committed value is '{version_code}'")
    if attrs.get("versionName") != version_name:
        raise Failure(f"manifest versionName is '{attrs.get('versionName')}', committed value is '{version_name}'")

    for label, blob in (("manifest", manifest), ("resources.pb", resources)):
        if STAGING_ID.encode() in blob:
            raise Failure(f"the staging id {STAGING_ID} appears in the {label}")
        if STAGING_NAME.encode() in blob:
            raise Failure(f"the staging app name appears in the {label}")

    checked = 0
    if google_services:
        staging_only = google_services_staging_only_values(google_services)
        for value in staging_only:
            checked += 1
            if value.encode() in manifest or value.encode() in resources:
                raise Failure("a staging-only google-services value is bundled in the AAB (value not printed)")
    return package, checked


def main(argv):
    if len(argv) not in (4, 5):
        print(__doc__, file=sys.stderr)
        return 2
    try:
        package, checked = verify(argv[1], argv[2], argv[3], argv[4] if len(argv) == 5 else None)
    except (Failure, OSError, KeyError, ValueError) as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    print(f"OK: package {package}, versionCode {argv[2]}, versionName {argv[3]}; "
          f"no staging id/name in manifest or resources; {checked} staging-only google-services value(s) checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
