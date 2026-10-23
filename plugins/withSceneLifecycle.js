/**
 * Adopts the UIScene life cycle for an Expo SDK 56 project.
 *
 * iOS 27 refuses to launch apps built with the iOS 27 SDK (Xcode 27) that
 * still use the old app-delegate window life cycle: "Application failed to
 * launch: UIScene life cycle is required". Expo SDK 58's template adopts
 * scenes; SDK 56's does not, and has no ExpoAppSceneDelegate to inherit from.
 * This plugin backports the same shape so the project can be built in Xcode 27:
 *
 *   1. Info.plist gets a UIApplicationSceneManifest pointing at SceneDelegate.
 *   2. ios/<App>/SceneDelegate.swift creates the window from the window scene
 *      and starts React Native in it, using the factory AppDelegate already
 *      creates. It forwards URLs and universal links to RCTLinkingManager,
 *      including the one that cold-launched the app.
 *   3. AppDelegate stops creating its own window (it would be orphaned).
 *
 * Remove this plugin when upgrading to Expo SDK 58+, whose template does this.
 */
const {
  withInfoPlist,
  withAppDelegate,
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE = `import UIKit
import React

// Added by plugins/withSceneLifecycle.js — see the comment there.
@objc(SceneDelegate)
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
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // A link that cold-launched the app arrives here rather than in
    // application(_:open:options:); pass it on as React Native expects.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity,
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
      ]
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    window.makeKeyAndVisible()
  }

  // Links opened while the app is running (e.g. comly://auth-callback).
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal links (https://comly.app/...) while running.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

// The SDK 56 template creates the window inside didFinishLaunching.
const WINDOW_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n\s*#endif\s*\n/;
const WINDOW_REPLACEMENT =
  '    // The window is created and React Native is started by SceneDelegate\n' +
  '    // (UIScene life cycle, required by the iOS 27 SDK). See plugins/withSceneLifecycle.js.\n';

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    const src = cfg.modResults.contents;
    if (!src.includes('created and React Native is started by SceneDelegate')) {
      if (!WINDOW_BLOCK.test(src)) {
        throw new Error('withSceneLifecycle: AppDelegate window block not found; the template may have changed');
      }
      cfg.modResults.contents = src.replace(WINDOW_BLOCK, WINDOW_REPLACEMENT);
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const file = path.join(cfg.modRequest.platformProjectRoot, projectName, 'SceneDelegate.swift');
      fs.writeFileSync(file, SCENE_DELEGATE);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filepath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project,
      });
    }
    return cfg;
  });

  return config;
};
