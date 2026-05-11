import * as SecureStore from 'expo-secure-store';

const Keys = {
  onboardingSeen: 'bs.onboarding.seen',
  biometricEnabled: 'bs.biometric.enabled',
  biometricAsked: 'bs.biometric.asked',
  anthropicApiKey: 'bs.anthropic.apiKey',
  geminiApiKey: 'bs.gemini.apiKey',
  aiClassifyEnabled: 'bs.aiClassify.enabled',
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

export async function getAnthropicApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(Keys.anthropicApiKey);
}

export async function setAnthropicApiKey(key: string | null): Promise<void> {
  if (key && key.trim()) {
    await SecureStore.setItemAsync(Keys.anthropicApiKey, key.trim());
  } else {
    await SecureStore.deleteItemAsync(Keys.anthropicApiKey);
  }
}

export async function getGeminiApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(Keys.geminiApiKey);
}

export async function setGeminiApiKey(key: string | null): Promise<void> {
  if (key && key.trim()) {
    await SecureStore.setItemAsync(Keys.geminiApiKey, key.trim());
  } else {
    await SecureStore.deleteItemAsync(Keys.geminiApiKey);
  }
}

export async function getAiClassifyEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(Keys.aiClassifyEnabled);
  return v === '1';
}

export async function setAiClassifyEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(Keys.aiClassifyEnabled, '1');
  } else {
    await SecureStore.deleteItemAsync(Keys.aiClassifyEnabled);
  }
}

export async function resetAllSecureStorage(): Promise<void> {
  await Promise.all(
    Object.values(Keys).map((k) => SecureStore.deleteItemAsync(k)),
  );
}
