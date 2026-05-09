export type RouteTarget = 'onboarding' | 'auth' | 'biometric-setup' | 'lock' | '(tabs)';

export type RouteState = {
  user: unknown;
  onboardingSeen: boolean;
  biometricEnabled: boolean;
  biometricAsked: boolean;
  biometricUnlocked: boolean;
};

export function pickTarget(s: RouteState): RouteTarget {
  if (!s.onboardingSeen) return 'onboarding';
  if (!s.user) return 'auth';
  if (!s.biometricAsked) return 'biometric-setup';
  if (s.biometricEnabled && !s.biometricUnlocked) return 'lock';
  return '(tabs)';
}

export function targetToHref(t: RouteTarget): string {
  switch (t) {
    case 'onboarding':
      return '/onboarding';
    case 'auth':
      return '/auth';
    case 'biometric-setup':
      return '/biometric-setup';
    case 'lock':
      return '/lock';
    case '(tabs)':
      return '/(tabs)';
  }
}
