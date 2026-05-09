const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches react-native-text-recognition's build.gradle to be compatible
 * with React Native 0.74 + Expo SDK 51:
 *  - Bumps compileSdkVersion/targetSdkVersion to 34
 *  - Removes deprecated jcenter() repository
 *  - Removes `com.facebook.react:react-native:+` Maven dep (broken in RN 0.71+;
 *    the react-native-gradle-plugin now owns that dependency)
 *  - Upgrades ML Kit from 16.0.0-beta1 → 16.0.0 stable
 */
module.exports = function withTextRecognitionFix(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const gradlePath = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        'react-native-text-recognition',
        'android',
        'build.gradle',
      );

      if (!fs.existsSync(gradlePath)) return config;

      let gradle = fs.readFileSync(gradlePath, 'utf8');

      gradle = gradle
        // Fix SDK versions
        .replace(
          /compileSdkVersion safeExtGet\('TextRecognition_compileSdkVersion',\s*\d+\)/,
          "compileSdkVersion safeExtGet('TextRecognition_compileSdkVersion', 34)",
        )
        .replace(
          /buildToolsVersion safeExtGet\('TextRecognition_buildToolsVersion',\s*'[\d.]+'\)/,
          "buildToolsVersion safeExtGet('TextRecognition_buildToolsVersion', '34.0.0')",
        )
        .replace(
          /targetSdkVersion safeExtGet\('TextRecognition_targetSdkVersion',\s*\d+\)/,
          "targetSdkVersion safeExtGet('TextRecognition_targetSdkVersion', 34)",
        )
        .replace(
          /minSdkVersion safeExtGet\('TextRecognition_minSdkVersion',\s*\d+\)/,
          "minSdkVersion safeExtGet('TextRecognition_minSdkVersion', 24)",
        )
        // Remove deprecated jcenter()
        .replace(/\s*jcenter\(\)\n?/g, '\n')
        // Remove the broken `com.facebook.react:react-native:+` Maven dep.
        // RN 0.71+ distributes react-native as a local file via node_modules,
        // not from Maven. The react-native-gradle-plugin handles it automatically.
        .replace(/\s*implementation "com\.facebook\.react:react-native:\$\{reactNativeVersion\}".*\n?/g, '\n')
        // Remove the now-unused ext block that defined reactNativeVersion
        .replace(/ext \{\s*reactNativeVersion = '[^']*'\s*\}\s*\n?/g, '')
        // Upgrade ML Kit from beta to stable
        .replace(
          "implementation 'com.google.mlkit:text-recognition:16.0.0-beta1'",
          "implementation 'com.google.mlkit:text-recognition:16.0.0'",
        );

      fs.writeFileSync(gradlePath, gradle);
      return config;
    },
  ]);
};
