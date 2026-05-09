export type RouteTarget =
  | 'onboarding'
  | 'auth'
  | 'verify-email'
  | 'profile-setup'
  | 'biometric-setup'
  | 'lock'
  | '(tabs)';

export type RouteState = {
  user: unknown;
  onboardingSeen: boolean;
  /** Whether the user's email is verified. Only meaningful when the user has
   *  an email address; phone-only users have `null` here. */
  emailVerified: boolean | null;
  /** True when the signed-in user must fill out a local profile (i.e. they
   *  signed up with email or phone). Google-only users skip the profile gate. */
  requiresProfile: boolean;
  profileComplete: boolean;
  biometricEnabled: boolean;
  biometricAsked: boolean;
  biometricUnlocked: boolean;
};

export function pickTarget(s: RouteState): RouteTarget {
  if (!s.onboardingSeen) return 'onboarding';
  if (!s.user) return 'auth';
  if (s.emailVerified === false) return 'verify-email';
  if (s.requiresProfile && !s.profileComplete) return 'profile-setup';
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
    case 'verify-email':
      return '/verify-email';
    case 'profile-setup':
      return '/profile-setup';
    case 'biometric-setup':
      return '/biometric-setup';
    case 'lock':
      return '/lock';
    case '(tabs)':
      return '/(tabs)';
  }
}
