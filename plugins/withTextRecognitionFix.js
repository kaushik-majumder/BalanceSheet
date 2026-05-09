const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches react-native-text-recognition's build.gradle to be compatible
 * with React Native 0.74 (compileSdkVersion 34, removes deprecated jcenter).
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
        // Remove deprecated jcenter() repository
        .replace(/\s*jcenter\(\)\n?/g, '\n');

      fs.writeFileSync(gradlePath, gradle);
      return config;
    },
  ]);
};
