#!/usr/bin/env ruby
# frozen_string_literal: true

# Makes sure GoogleService-Info.plist is a resource of the iOS app target, so it
# is copied into the app bundle. Idempotent: does nothing when the target already
# has it. Edits the project through the xcodeproj gem, never as text.
# Exits non-zero if the plist file is absent.

require_relative 'ios-project-lib'

proj = IosProject.project
target = IosProject.app_target(proj)
plist = IosProject.plist_path(target)

unless File.file?(plist)
  IosProject.fail!("#{plist} is missing. Supply it (secret) or run scripts/ios-write-dummy-google-service-plist.rb for a compile-only build.")
end

resources_phase = target.resources_build_phase
same_file = ->(ref) { ref && File.expand_path(ref.real_path.to_s) == File.expand_path(plist) }

if resources_phase.files_references.any?(&same_file)
  puts "#{PLIST_NAME} is already a resource of target #{target.name}; nothing to do."
  exit 0
end

# Reuse an existing file reference; otherwise create one in the same group as
# the app's Info.plist, with a path that resolves to the real file.
reference = proj.files.find(&same_file)
unless reference
  info_plist = File.join(IosProject::REPO_ROOT, IosProject.setting(target, 'INFOPLIST_FILE').then { |f| File.join('ios', f) })
  sibling = proj.files.find { |ref| File.expand_path(ref.real_path.to_s) == File.expand_path(info_plist) }
  group = sibling ? sibling.parent : proj.main_group
  relative = Pathname.new(plist).relative_path_from(group.real_path).to_s
  reference = group.new_reference(relative)
end
resources_phase.add_file_reference(reference, true)
proj.save
puts "Added #{PLIST_NAME} to the resources of target #{target.name}."
