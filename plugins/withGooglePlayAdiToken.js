const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Google Play "Sign and upload an APK" package-name verification.
 *
 * Play Console issues a one-time token per package + developer account
 * (e.g. CXJ3ZKNU33YVSAAAAAAAAAAAA). The token must appear inside the
 * APK at `assets/adi-registration.properties` so Google can confirm
 * the developer who uploaded the APK is the same one that registered
 * the package in the console.
 *
 * Source for the token: process.env.GOOGLE_PLAY_ADI_TOKEN. If unset
 * the plugin is a no-op so dev builds keep working without leaking
 * the value through git. Once Play has verified the package the file
 * can stay or be removed — verification is one-time per package.
 *
 * The plugin writes the file into the prebuild output at:
 *   android/app/src/main/assets/adi-registration.properties
 * Anything Gradle puts in app/src/main/assets/ is bundled at the
 * APK's top-level `assets/` namespace, which is what Google checks.
 */
module.exports = function withGooglePlayAdiToken(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const token = (process.env.GOOGLE_PLAY_ADI_TOKEN || '').trim();
      if (!token) {
        // Skip silently — preview/dev builds that don't need the token
        // shouldn't fail just because the env var isn't set.
        return cfg;
      }
      const assetsDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
      );
      fs.mkdirSync(assetsDir, { recursive: true });
      const filePath = path.join(assetsDir, 'adi-registration.properties');
      // File contents: just the token followed by a trailing newline.
      // Google's verifier looks for the token string anywhere in the
      // file, so format details (key=value vs raw) don't matter.
      fs.writeFileSync(filePath, `${token}\n`, 'utf8');
      return cfg;
    },
  ]);
};
