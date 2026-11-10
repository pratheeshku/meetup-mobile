#!/usr/bin/env ruby
# frozen_string_literal: true

# Usage: ruby scripts/ios-set-environment.rb <production|staging>
#
# `production` is a no-op. `staging` rewrites the CHECKED-OUT Xcode project (never
# commit the result) so the app target builds as the staging app: bundle id and
# display name come from "environments.staging" in config/appConfig.json, the
# single source shared with the JS config and the Android flavor. Idempotent.
# Edits the project through the xcodeproj gem, never as text.
#
# Run it BEFORE scripts/ios-project-info.rb and the GoogleService plist steps, so
# IOS_BUNDLE_ID, the dummy plist and the plist/bundle-id check all see the staging id.
# The build must also set APP_ENV=staging in the build-time .env (JS selects its
# API URL and legal links from it, config/environment.ts).
#
# Other places that depend on the bundle id are NOT changed here; see the Task 3.1
# report (URL scheme / REVERSED_CLIENT_ID, push + Sign in with Apple capabilities,
# provisioning profile, GoogleService-Info.plist for the staging bundle id).

require 'json'
require_relative 'ios-project-lib'

environment = ARGV[0]
unless %w[production staging].include?(environment) && ARGV.length == 1
  IosProject.fail!('usage: ios-set-environment.rb <production|staging>')
end

if environment == 'production'
  puts 'production: project left unchanged.'
  exit 0
end

config_path = File.join(IosProject::REPO_ROOT, 'config', 'appConfig.json')
staging = JSON.parse(File.read(config_path)).dig('environments', 'staging') || {}
bundle_id = staging['applicationId'].to_s
display_name = staging['displayName'].to_s
IosProject.fail!('environments.staging needs applicationId and displayName in config/appConfig.json') if bundle_id.empty? || display_name.empty?

proj = IosProject.project
target = IosProject.app_target(proj)
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
  config.build_settings['APP_DISPLAY_NAME'] = display_name
end
proj.save

# Info.plist carries CFBundleDisplayName; make it follow the build setting, as the
# TestFlight workflow's APP_DISPLAY_NAME override already expects.
info_plist = File.join(IosProject::REPO_ROOT, IosProject.setting(target, 'INFOPLIST_FILE').then { |f| File.join('ios', f) })
info = Xcodeproj::Plist.read_from_path(info_plist)
if info['CFBundleDisplayName'] != '$(APP_DISPLAY_NAME)'
  info['CFBundleDisplayName'] = display_name
  Xcodeproj::Plist.write_to_path(info, info_plist)
end

puts "staging: target #{target.name} now uses bundle id #{bundle_id} and display name '#{display_name}'."
