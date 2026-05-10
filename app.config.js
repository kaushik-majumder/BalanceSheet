const withTextRecognitionFix = require('./plugins/withTextRecognitionFix');

module.exports = ({ config }) => {
  return withTextRecognitionFix({
    ...config,
    name: 'Receipt Scanner',
    slug: 'receipt-scanner',
    version: '1.0.0',
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: 'https://u.expo.dev/bbdefab5-4cc5-4480-96a9-8ece7eb913a5',
      fallbackToCacheTimeout: 0,
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0F172A',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.kaushikmajumder.receiptscanner',
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
      infoPlist: {
        NSCameraUsageDescription: 'ReceiptScanner needs camera access to scan receipts.',
        NSPhotoLibraryUsageDescription:
          'ReceiptScanner needs photo library access to import receipts.',
        NSFaceIDUsageDescription: 'Use Face ID to quickly and securely unlock ReceiptScanner.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0F172A',
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
      ],
      package: 'com.kaushikmajumder.receiptscanner',
      versionCode: 1,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      ['expo-camera', { cameraPermission: 'Allow ReceiptScanner to access your camera.' }],
      ['expo-image-picker', { photosPermission: 'Allow ReceiptScanner to access your photos.' }],
      [
        'expo-build-properties',
        {
          ios: { useFrameworks: 'static' },
          android: {},
        },
      ],
    ],
    experiments: { typedRoutes: true },
    scheme: 'receipt-scanner',
    extra: {
      eas: { projectId: 'bbdefab5-4cc5-4480-96a9-8ece7eb913a5' },
      googleWebClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
        '858326644205-etreldr96iispa3mr6cv6vcfv1ivukf1.apps.googleusercontent.com',
      // Gemini API key for AI-powered classification — sourced from the
      // EAS sensitive env var GEMINI_API_KEY at build/update time so the
      // raw value never lives in this repo. Restricted server-side to
      // this app's package + SHA-1 so an extracted key can't be abused
      // outside the app.
      geminiApiKey: process.env.GEMINI_API_KEY,
    },
  });
};
