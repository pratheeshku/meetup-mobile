#!/usr/bin/env ruby
# frozen_string_literal: true

# Prints KEY=VALUE lines (workspace, scheme, bundle id, ...) read from the Xcode
# project, ready to append to $GITHUB_ENV. Keeps those names out of the workflows.

require_relative 'ios-project-lib'

proj = IosProject.project
target = IosProject.app_target(proj)

puts "IOS_WORKSPACE=#{IosProject.workspace_name}"
puts "IOS_SCHEME=#{IosProject.scheme_name}"
puts "IOS_BUNDLE_ID=#{IosProject.bundle_id(target)}"
puts "IOS_APP_DIR=#{IosProject.app_dir(target)}"
puts "IOS_PLIST_PATH=#{File.join(IosProject.app_dir(target), PLIST_NAME)}"
