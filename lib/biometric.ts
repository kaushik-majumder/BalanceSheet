import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { available: hasHardware, enrolled: isEnrolled, types };
}

export async function authenticateWithBiometric(reason: string): Promise<boolean> {
  const cap = await getBiometricCapability();
  if (!cap.available || !cap.enrolled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
