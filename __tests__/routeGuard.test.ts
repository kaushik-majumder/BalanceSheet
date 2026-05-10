import { pickTarget, targetToHref, RouteState } from '../lib/routeGuard';

const baseState: RouteState = {
  user: null,
  onboardingSeen: false,
  emailVerified: null,
  requiresProfile: false,
  profileComplete: false,
  biometricEnabled: false,
  biometricAsked: false,
  biometricUnlocked: false,
};

const signedInBase: RouteState = {
  ...baseState,
  user: { uid: 'u1' },
  onboardingSeen: true,
  emailVerified: true,
  requiresProfile: false,
  profileComplete: true,
  biometricAsked: true,
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

describe('pickTarget — email verification gate', () => {
  it('routes email users with unverified email to verify-email', () => {
    const s: RouteState = { ...signedInBase, emailVerified: false };
    expect(pickTarget(s)).toBe('verify-email');
  });

  it('skips verify-email for phone-only users (emailVerified=null)', () => {
    const s: RouteState = { ...signedInBase, emailVerified: null };
    expect(pickTarget(s)).toBe('(tabs)');
  });

  it('email verification gate fires before profile setup', () => {
    const s: RouteState = {
      ...signedInBase,
      emailVerified: false,
      requiresProfile: true,
      profileComplete: false,
    };
    expect(pickTarget(s)).toBe('verify-email');
  });
});

describe('pickTarget — profile setup gate', () => {
  it('email user with verified email + missing profile goes to profile-setup', () => {
    const s: RouteState = {
      ...signedInBase,
      emailVerified: true,
      requiresProfile: true,
      profileComplete: false,
    };
    expect(pickTarget(s)).toBe('profile-setup');
  });

  it('phone user with missing profile goes to profile-setup (no email gate)', () => {
    const s: RouteState = {
      ...signedInBase,
      emailVerified: null,
      requiresProfile: true,
      profileComplete: false,
    };
    expect(pickTarget(s)).toBe('profile-setup');
  });

  it('Google user with missing profile is NOT asked — google sign-in has displayName', () => {
    const s: RouteState = {
      ...signedInBase,
      emailVerified: true,
      requiresProfile: false, // computed by AuthContext from provider
      profileComplete: false,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });

  it('once profile is complete, gate releases', () => {
    const s: RouteState = {
      ...signedInBase,
      requiresProfile: true,
      profileComplete: true,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });

  it('profile gate fires before biometric setup', () => {
    const s: RouteState = {
      ...signedInBase,
      requiresProfile: true,
      profileComplete: false,
      biometricAsked: false,
    };
    expect(pickTarget(s)).toBe('profile-setup');
  });
});

describe('pickTarget — biometric setup gate', () => {
  it('shows biometric setup right after first sign-in (post-profile)', () => {
    const s: RouteState = {
      ...signedInBase,
      biometricAsked: false,
    };
    expect(pickTarget(s)).toBe('biometric-setup');
  });

  it('does not re-show setup after the user has been asked', () => {
    expect(pickTarget(signedInBase)).toBe('(tabs)');
  });
});

describe('pickTarget — lock gate', () => {
  it('locks the app on launch when biometric is enabled', () => {
    const s: RouteState = {
      ...signedInBase,
      biometricEnabled: true,
      biometricUnlocked: false,
    };
    expect(pickTarget(s)).toBe('lock');
  });

  it('lets the user in once biometric has been verified for the session', () => {
    const s: RouteState = {
      ...signedInBase,
      biometricEnabled: true,
      biometricUnlocked: true,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });

  it('does not lock when user declined biometric', () => {
    const s: RouteState = {
      ...signedInBase,
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

  it('auth always wins over verify-email', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: null,
      emailVerified: false,
    };
    expect(pickTarget(s)).toBe('auth');
  });

  it('verify-email wins over profile-setup', () => {
    const s: RouteState = {
      ...signedInBase,
      emailVerified: false,
      requiresProfile: true,
      profileComplete: false,
    };
    expect(pickTarget(s)).toBe('verify-email');
  });

  it('profile-setup wins over biometric-setup', () => {
    const s: RouteState = {
      ...signedInBase,
      requiresProfile: true,
      profileComplete: false,
      biometricAsked: false,
    };
    expect(pickTarget(s)).toBe('profile-setup');
  });

  it('biometric-setup wins over lock', () => {
    const s: RouteState = {
      ...signedInBase,
      biometricAsked: false,
      biometricEnabled: true,
    };
    expect(pickTarget(s)).toBe('biometric-setup');
  });
});

describe('pickTarget — modal/edit screen regression', () => {
  // Regression: when user opens /settings (a modal), an over-eager guard used
  // to either bounce them back to /(tabs) (because target='(tabs)' !==
  // current='settings') or silently skip enforcement entirely (which then
  // failed to redirect on sign-out from the modal).
  //
  // pickTarget is pure and unaware of modals — it always returns the right
  // *flow* target. The layout's effect is responsible for honoring modals
  // when target='(tabs)'. These tests assert pickTarget itself stays correct.

  it('on settings modal, signed in: target is (tabs) — layout will then leave user alone', () => {
    expect(pickTarget(signedInBase)).toBe('(tabs)');
  });

  it('on settings modal, after sign-out: target flips to auth so layout redirects', () => {
    const s: RouteState = { ...signedInBase, user: null };
    expect(pickTarget(s)).toBe('auth');
  });

  it('on profile-setup voluntarily, profile complete: target is (tabs) so layout leaves user alone', () => {
    // requiresProfile=true (email/phone provider) BUT profileComplete=true,
    // so the gate releases. Layout sees current='profile-setup', target='(tabs)',
    // and skips the redirect because profile-setup is sticky-voluntary.
    const s: RouteState = {
      ...signedInBase,
      requiresProfile: true,
      profileComplete: true,
    };
    expect(pickTarget(s)).toBe('(tabs)');
  });

  it('on profile-setup as required gate, profile incomplete: target is profile-setup', () => {
    const s: RouteState = {
      ...signedInBase,
      requiresProfile: true,
      profileComplete: false,
    };
    expect(pickTarget(s)).toBe('profile-setup');
  });
});

describe('pickTarget — sign-out race regression', () => {
  // Regression: previously, signOut() synchronously set biometricUnlocked=false
  // BEFORE Firebase's auth listener cleared user, leaving an intermediate
  // render with { user: <old>, biometricUnlocked: false } that briefly routed
  // to /lock and triggered the OS biometric prompt.
  it('intermediate render with logged-out user but stale biometricUnlocked goes to auth, not lock', () => {
    const s: RouteState = {
      ...baseState,
      onboardingSeen: true,
      user: null,
      biometricAsked: true,
      biometricEnabled: true,
      biometricUnlocked: true, // stale — never re-rendered after sign-out
    };
    expect(pickTarget(s)).toBe('auth');
  });

  it('biometricUnlocked has no effect when user is null', () => {
    for (const unlocked of [true, false]) {
      const s: RouteState = {
        ...baseState,
        onboardingSeen: true,
        user: null,
        biometricUnlocked: unlocked,
      };
      expect(pickTarget(s)).toBe('auth');
    }
  });
});

describe('targetToHref', () => {
  it('maps every target to a leading-slash route', () => {
    const targets = [
      'onboarding',
      'auth',
      'verify-email',
      'profile-setup',
      'biometric-setup',
      'lock',
      '(tabs)',
    ] as const;
    for (const t of targets) {
      const href = targetToHref(t);
      expect(href.startsWith('/')).toBe(true);
    }
  });

  it('produces stable hrefs that the router can replace to', () => {
    expect(targetToHref('onboarding')).toBe('/onboarding');
    expect(targetToHref('auth')).toBe('/auth');
    expect(targetToHref('verify-email')).toBe('/verify-email');
    expect(targetToHref('profile-setup')).toBe('/profile-setup');
    expect(targetToHref('biometric-setup')).toBe('/biometric-setup');
    expect(targetToHref('lock')).toBe('/lock');
    expect(targetToHref('(tabs)')).toBe('/(tabs)');
  });
});
