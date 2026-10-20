/**
 * Raises every CocoaPods target's iOS deployment target to the app's own.
 *
 * Some libraries ship resource-bundle targets whose podspecs still say
 * iOS 12.4 (react-native-svg's RNSVGFilters) or 13.4 (async-storage's
 * resources). The app's `platform :ios` line doesn't override those, and
 * Xcode 27 refuses to archive any target below iOS 15.0. This adds a step to
 * the generated Podfile's post_install that lifts anything lower up to the
 * app's deployment target, so it applies to every prebuild, local or EAS.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# comly: raise pod deployment targets';

const SNIPPET = `
    ${MARKER}
    min_ios = podfile_properties['ios.deploymentTarget'] || '16.4'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new(min_ios)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios
        end
      end
    end
`;

module.exports = function withPodsMinimumDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (!src.includes(MARKER)) {
        // Insert right after react_native_post_install(...), inside post_install.
        const anchor = /(react_native_post_install\([\s\S]*?\n\s*\)\n)/;
        if (!anchor.test(src)) {
          throw new Error('withPodsMinimumDeploymentTarget: post_install anchor not found in Podfile');
        }
        src = src.replace(anchor, `$1${SNIPPET}`);
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
};
