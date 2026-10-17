import UIKit
import React
import React_RCTAppDelegate

/// UIScene lifecycle entry point (required when building with the iOS 27 SDK).
/// One window, one scene (`UIApplicationSupportsMultipleScenes` = NO). The window
/// is created here and React Native is started in it; process-level setup
/// (Firebase, the RN factory, APNs / notification callbacks) stays in `AppDelegate`.
///
/// React Native 0.86.3 has no scene-aware API (that lands in 0.88), so the scene's
/// connection options are converted to classic launch options here, and URLs and
/// user activities are forwarded to `RCTLinkingManager`'s app-delegate class methods.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Libraries still read UIApplication.shared.delegate?.window (e.g.
    // react-native-image-crop-picker presents its picker from it).
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "MeetupMobile",
      in: window,
      launchOptions: SceneDelegate.launchOptions(from: connectionOptions)
    )
  }

  // URLs opened while the app is running (cold-start URLs arrive in connectionOptions).
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal links / user activities while the app is running.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      appDelegate.window === window
    {
      appDelegate.window = nil
    }
  }

  /// What the old app-delegate `launchOptions` carried for URLs and user activities, so
  /// `Linking.getInitialURL()` still works on a cold start (same mapping as React Native 0.88).
  static func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any] {
    var options: [UIApplication.LaunchOptionsKey: Any] = [:]

    if let url = connectionOptions.urlContexts.first?.url {
      options[.url] = url
    }

    if let activity = connectionOptions.userActivities.first {
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    return options
  }
}
