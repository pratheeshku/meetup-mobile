# frozen_string_literal: true

# Shared lookups for the scripts/ios-*.rb helpers. Nothing here is hardcoded:
# the project, app target, bundle identifier and Info.plist folder are all read
# from the Xcode project. Needs the `xcodeproj` gem (installed with CocoaPods).

require 'xcodeproj'

PLIST_NAME = 'GoogleService-Info.plist'

module IosProject
  REPO_ROOT = File.expand_path('..', __dir__)

  def self.fail!(message)
    warn "ERROR: #{message}"
    exit 1
  end

  def self.project_path
    found = Dir.glob(File.join(REPO_ROOT, 'ios', '*.xcodeproj'))
    fail!("expected exactly one ios/*.xcodeproj, found #{found.length}") unless found.length == 1
    found.first
  end

  def self.project
    Xcodeproj::Project.open(project_path)
  end

  def self.app_target(proj)
    target = proj.native_targets.find { |t| t.product_type == 'com.apple.product-type.application' }
    fail!('no application target in the Xcode project') unless target
    target
  end

  def self.setting(target, key, config = 'Release')
    target.build_configuration_list[config]&.build_settings&.[](key)
  end

  def self.bundle_id(target)
    value = setting(target, 'PRODUCT_BUNDLE_IDENTIFIER')
    fail!('PRODUCT_BUNDLE_IDENTIFIER is not set on the app target') if value.nil? || value.empty?
    if value.include?('$(')
      fail!("PRODUCT_BUNDLE_IDENTIFIER is not a literal value (#{value}); cannot resolve it here")
    end
    value
  end

  # Folder (relative to the repo root) that holds the app's Info.plist; the
  # Firebase plist lives next to it.
  def self.app_dir(target)
    info_plist = setting(target, 'INFOPLIST_FILE')
    fail!('INFOPLIST_FILE is not set on the app target') if info_plist.nil? || info_plist.empty?
    File.join('ios', File.dirname(info_plist))
  end

  def self.plist_path(target)
    File.join(REPO_ROOT, app_dir(target), PLIST_NAME)
  end

  def self.scheme_name
    names = Xcodeproj::Project.schemes(project_path)
    fail!('no shared scheme found in the Xcode project') if names.empty?
    names.first
  end

  def self.workspace_name
    "#{File.basename(project_path, '.xcodeproj')}.xcworkspace"
  end
end
