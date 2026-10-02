#!/usr/bin/env ruby
# frozen_string_literal: true

# Writes a clearly fake, minimal GoogleService-Info.plist so the app COMPILES in
# CI without the real Firebase file. Every value is an obvious placeholder; only
# the bundle identifier is real (read from the Xcode project). The result cannot
# talk to Firebase. The file is git-ignored; never commit it. Refuses to
# overwrite an existing file, so it can never replace a real plist.

require_relative 'ios-project-lib'

target = IosProject.app_target(IosProject.project)
plist = IosProject.plist_path(target)

if File.exist?(plist)
  IosProject.fail!("#{plist} already exists; not overwriting it.")
end

placeholder = 'PLACEHOLDER-NOT-A-REAL-VALUE'
values = {
  'API_KEY' => placeholder,
  'GCM_SENDER_ID' => '000000000000',
  'PLIST_VERSION' => '1',
  'BUNDLE_ID' => IosProject.bundle_id(target),
  'PROJECT_ID' => 'placeholder-not-a-real-project',
  'STORAGE_BUCKET' => 'placeholder-not-a-real-project.invalid',
  'IS_ADS_ENABLED' => false,
  'IS_ANALYTICS_ENABLED' => false,
  'IS_APPINVITE_ENABLED' => false,
  'IS_GCM_ENABLED' => true,
  'IS_SIGNIN_ENABLED' => false,
  'GOOGLE_APP_ID' => '1:000000000000:ios:0000000000000000000000'
}
Xcodeproj::Plist.write_to_path(values, plist)
puts "Wrote placeholder #{PLIST_NAME} (compile-only) to #{plist}."
