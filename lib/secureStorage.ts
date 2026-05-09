import * as SecureStore from 'expo-secure-store';

const Keys = {
  onboardingSeen: 'bs.onboarding.seen',
  biometricEnabled: 'bs.biometric.enabled',
  biometricAsked: 'bs.biometric.asked',
} as const;

export async function getOnboardingSeen(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(Keys.onboardingSeen);
  return v === '1';
}

export async function setOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(Keys.onboardingSeen, '1');
}

export async function getBiometricEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(Keys.biometricEnabled);
  return v === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(Keys.biometricEnabled, '1');
  } else {
    await SecureStore.deleteItemAsync(Keys.biometricEnabled);
  }
}

export async function getBiometricAsked(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(Keys.biometricAsked);
  return v === '1';
}

export async function setBiometricAsked(): Promise<void> {
  await SecureStore.setItemAsync(Keys.biometricAsked, '1');
}
