import { pickTarget, targetToHref, RouteState } from '../lib/routeGuard';

const baseState: RouteState = {
  user: null,
  onboardingSeen: false,
  biometricEnabled: false,
  biometricAsked: false,
  biometricUnlocked: false,
};

describe('pickTarget — onboarding gate', () => {
  it('routes new users to onboarding', () => {
    expect(pickTarget(baseState)).toBe('onboarding');
  });

  it('keeps onboarding even if a user is somehow set (defensive)', () => {
    expect(pickTarget({ ...baseState, user: { uid: 'x' } })).toBe('onboarding');
  });
});

describe('pickTarget — auth gate', () => {
  it('routes onboarded users without a session to auth', () => {
    expect(pickTarget({ ...baseState, onboardingSeen: true })).toBe('auth');
  });

  it('treats undefined user as logged out', () => {
    const s = { ...baseState, onboardingSeen: true, user: undefined };
    expect(pickTarget(s)).toBe('auth');
  });
});

describe('pickTarget — biometric setup gate', () => {
  it('shows biometric setup right after first sign-in', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: { uid: 'u1' },
    };
    expect(pickTarget(s)).toBe('biometric-setup');
  });

  it('does not re-show setup after the user has been asked', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: { uid: 'u1' },
      biometricAsked: true,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });
});

describe('pickTarget — lock gate', () => {
  it('locks the app on launch when biometric is enabled', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: { uid: 'u1' },
      biometricAsked: true,
      biometricEnabled: true,
      biometricUnlocked: false,
    };
    expect(pickTarget(s)).toBe('lock');
  });

  it('lets the user in once biometric has been verified for the session', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: { uid: 'u1' },
      biometricAsked: true,
      biometricEnabled: true,
      biometricUnlocked: true,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });

  it('does not lock when user declined biometric', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: { uid: 'u1' },
      biometricAsked: true,
      biometricEnabled: false,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });
});

describe('pickTarget — gate ordering invariants', () => {
  it('onboarding always wins over auth', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: false,
      user: { uid: 'u1' },
    };
    expect(pickTarget(s)).toBe('onboarding');
  });

  it('auth always wins over biometric setup', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: null,
      biometricAsked: false,
    };
    expect(pickTarget(s)).toBe('auth');
  });

  it('biometric setup always wins over lock', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: { uid: 'u1' },
      biometricAsked: false,
      biometricEnabled: true,
    };
    expect(pickTarget(s)).toBe('biometric-setup');
  });
});

describe('targetToHref', () => {
  it('maps every target to a leading-slash route', () => {
    const targets = ['onboarding', 'auth', 'biometric-setup', 'lock', '(tabs)'] as const;
    for (const t of targets) {
      const href = targetToHref(t);
      expect(href.startsWith('/')).toBe(true);
    }
  });

  it('produces stable hrefs that the router can replace to', () => {
    expect(targetToHref('onboarding')).toBe('/onboarding');
    expect(targetToHref('auth')).toBe('/auth');
    expect(targetToHref('biometric-setup')).toBe('/biometric-setup');
    expect(targetToHref('lock')).toBe('/lock');
    expect(targetToHref('(tabs)')).toBe('/(tabs)');
  });
});
