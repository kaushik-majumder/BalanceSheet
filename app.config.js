const withTextRecognitionFix = require('./plugins/withTextRecognitionFix');

module.exports = ({ config }) => {
  return withTextRecognitionFix({
    ...config,
    name: 'Receipt Scanner',
    slug: 'receipt-scanner',
    version: '1.0.0',
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
      infoPlist: {
        NSCameraUsageDescription: 'ReceiptScanner needs camera access to scan receipts.',
        NSPhotoLibraryUsageDescription:
          'ReceiptScanner needs photo library access to import receipts.',
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
      ],
      package: 'com.kaushikmajumder.receiptscanner',
      versionCode: 1,
    },
    plugins: [
      'expo-router',
      ['expo-camera', { cameraPermission: 'Allow ReceiptScanner to access your camera.' }],
      ['expo-image-picker', { photosPermission: 'Allow ReceiptScanner to access your photos.' }],
    ],
    experiments: { typedRoutes: true },
    scheme: 'receipt-scanner',
    extra: {
      eas: { projectId: 'bbdefab5-4cc5-4480-96a9-8ece7eb913a5' },
    },
  });
};
