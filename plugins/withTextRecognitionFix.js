const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Two fixes bundled into one plugin:
 *
 * 1. Patches react-native-text-recognition's build.gradle for RN 0.74 + Expo SDK 51:
 *    - Bumps compileSdkVersion/targetSdkVersion to 34
 *    - Removes deprecated jcenter() repository
 *    - Removes com.facebook.react:react-native:+ Maven dep (broken since RN 0.71)
 *    - Upgrades ML Kit from 16.0.0-beta1 → 16.0.0 stable
 *    - Adds namespace declaration (required by AGP 8.0+)
 *
 * 2. Downgrades Gradle wrapper from 8.8 → 8.6.
 *    expo-modules-core@1.12.x uses `from components.release` which relies on
 *    synchronous component registration removed in Gradle 8.8. Gradle 8.6 is
 *    the latest version fully compatible with Expo SDK 51.
 */
module.exports = function withTextRecognitionFix(config) {
  // Fix 1: patch react-native-text-recognition build.gradle
  config = withDangerousMod(config, [
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
        .replace(
          /compileSdkVersion safeExtGet\('TextRecognition_compileSdkVersion',\s*\d+\)/,
          "compileSdkVersion safeExtGet('TextRecognition_compileSdkVersion', 35)",
        )
        .replace(
          /buildToolsVersion safeExtGet\('TextRecognition_buildToolsVersion',\s*'[\d.]+'\)/,
          "buildToolsVersion safeExtGet('TextRecognition_buildToolsVersion', '35.0.0')",
        )
        .replace(
          /targetSdkVersion safeExtGet\('TextRecognition_targetSdkVersion',\s*\d+\)/,
          "targetSdkVersion safeExtGet('TextRecognition_targetSdkVersion', 35)",
        )
        .replace(
          /minSdkVersion safeExtGet\('TextRecognition_minSdkVersion',\s*\d+\)/,
          "minSdkVersion safeExtGet('TextRecognition_minSdkVersion', 23)",
        )
        .replace(/\s*jcenter\(\)\n?/g, '\n')
        // RN 0.71+ renamed the Maven artifact from react-native to react-android
        .replace(
          /\s*implementation "com\.facebook\.react:react-native:\$\{reactNativeVersion\}".*\n?/g,
          '\n    implementation "com.facebook.react:react-android"\n',
        )
        .replace(/ext \{\s*reactNativeVersion = '[^']*'\s*\}\s*\n?/g, '')
        .replace(
          "implementation 'com.google.mlkit:text-recognition:16.0.0-beta1'",
          "implementation 'com.google.mlkit:text-recognition:16.0.0'",
        )
        .replace("apply plugin: 'com.android.library'", "apply plugin: 'com.android.library'\n");

      // Only add namespace if not already present (idempotent)
      if (!gradle.includes("namespace 'com.reactnativetextrecognition'")) {
        gradle = gradle.replace(/android \{/, "android {\n    namespace 'com.reactnativetextrecognition'");
      }

      fs.writeFileSync(gradlePath, gradle);
      return config;
    },
  ]);

  // Fix 2: inject TextRecognition ext properties into root android/build.gradle so safeExtGet
  // returns the correct values regardless of whether node_modules was patched (e.g. after cache restore)
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'build.gradle',
      );

      if (!fs.existsSync(buildGradlePath)) return config;

      let content = fs.readFileSync(buildGradlePath, 'utf8');

      if (!content.includes('TextRecognition_compileSdkVersion')) {
        content = content.replace(
          /ext\s*\{/,
          `ext {\n        TextRecognition_compileSdkVersion = 35\n        TextRecognition_buildToolsVersion = '35.0.0'\n        TextRecognition_targetSdkVersion = 35\n        TextRecognition_minSdkVersion = 23`,
        );
      }

      fs.writeFileSync(buildGradlePath, content);
      return config;
    },
  ]);

  // Fix 3: downgrade Gradle wrapper to 8.6 (last version compatible with expo-modules-core@1.12.x)
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties',
      );

      if (!fs.existsSync(wrapperPath)) return config;

      let content = fs.readFileSync(wrapperPath, 'utf8');
      content = content.replace(
        /distributionUrl=.*gradle-[\d.]+-all\.zip/,
        'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.6-all.zip',
      );
      fs.writeFileSync(wrapperPath, content);
      return config;
    },
  ]);

  return config;
};
