import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import {
  AuthProvider as FirebaseProviderId,
  AuthUser,
  configureGoogleSignIn,
  deleteCurrentAccount,
  getPrimaryProvider,
  onAuthStateChanged,
  reloadCurrentUser,
  requiresProfileForProvider,
  signOutEverywhere,
} from './auth';
import { Profile, getProfile, deleteProfile } from './profile';
import { deleteAllReceipts, setCurrentUserId } from './database';
import {
  getBiometricAsked,
  getBiometricEnabled,
  getOnboardingSeen,
  setBiometricAsked as persistBiometricAsked,
  setBiometricEnabled as persistBiometricEnabled,
  setOnboardingSeen as persistOnboardingSeen,
  resetAllSecureStorage,
} from './secureStorage';

type AuthState = {
  initializing: boolean;
  user: AuthUser | null;
  provider: FirebaseProviderId;
  /** null when user has no email (phone-only). */
  emailVerified: boolean | null;
  requiresProfile: boolean;
  profile: Profile | null;
  profileComplete: boolean;
  onboardingSeen: boolean;
  biometricEnabled: boolean;
  biometricAsked: boolean;
  biometricUnlocked: boolean;
  markOnboardingSeen: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  markBiometricAsked: () => Promise<void>;
  markBiometricUnlocked: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [onboardingSeen, setOnboardingSeenState] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAsked, setBiometricAskedState] = useState(false);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);

  useEffect(() => {
    const webClientId =
      (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ??
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (webClientId) {
      configureGoogleSignIn(webClientId);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [seen, bio, asked] = await Promise.all([
        getOnboardingSeen(),
        getBiometricEnabled(),
        getBiometricAsked(),
      ]);
      if (!mounted) return;
      setOnboardingSeenState(seen);
      setBiometricEnabledState(bio);
      setBiometricAskedState(asked);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load (or clear) the local profile whenever the signed-in user changes.
  useEffect(() => {
    let mounted = true;
    if (!user) {
      setProfileState(null);
      setProfileLoaded(true);
      return;
    }
    setProfileLoaded(false);
    (async () => {
      try {
        const p = await getProfile(user.uid);
        if (!mounted) return;
        setProfileState(p);
      } finally {
        if (mounted) setProfileLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      setUser(u);
      if (!u) setBiometricUnlocked(false);
      setInitializing(false);
      // Push the new uid into the database layer so every read/write
      // it performs filters by the right user. Awaiting isn't useful
      // here — the backfill runs in the background and the user
      // doesn't see DB queries fire until a downstream screen mounts
      // (which is well after the next tick).
      setCurrentUserId(u?.uid ?? null).catch(() => {
        // setCurrentUserId is intentionally tolerant of pre-migration
        // schemas; any error here is non-fatal.
      });
    });
    return unsub;
  }, []);

  const provider = useMemo(() => getPrimaryProvider(user), [user]);
  const requiresProfile = useMemo(() => requiresProfileForProvider(provider), [provider]);
  const profileComplete = profile !== null;
  const emailVerified: boolean | null = user
    ? user.email
      ? user.emailVerified
      : null
    : null;

  const refreshUser = useCallback(async () => {
    const u = await reloadCurrentUser();
    setUser(u);
    return u;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfileState(null);
      return;
    }
    const p = await getProfile(user.uid);
    setProfileState(p);
  }, [user?.uid]);

  const value = useMemo<AuthState>(
    () => ({
      initializing: initializing || (user !== null && !profileLoaded),
      user,
      provider,
      emailVerified,
      requiresProfile,
      profile,
      profileComplete,
      onboardingSeen,
      biometricEnabled,
      biometricAsked,
      biometricUnlocked,
      markOnboardingSeen: async () => {
        await persistOnboardingSeen();
        setOnboardingSeenState(true);
      },
      setBiometricEnabled: async (enabled: boolean) => {
        await persistBiometricEnabled(enabled);
        setBiometricEnabledState(enabled);
        if (enabled) setBiometricUnlocked(true);
      },
      markBiometricAsked: async () => {
        await persistBiometricAsked();
        setBiometricAskedState(true);
      },
      markBiometricUnlocked: () => setBiometricUnlocked(true),
      refreshUser,
      refreshProfile,
      setProfile: (p: Profile) => setProfileState(p),
      signOut: async () => {
        // Don't clear biometricUnlocked synchronously — the onAuthStateChanged
        // listener does it when user becomes null. Doing both here causes a
        // race where React renders { user: <old>, biometricUnlocked: false }
        // before the listener fires, briefly routing to the lock screen and
        // triggering the OS biometric prompt.
        await signOutEverywhere();
      },
      deleteAccount: async () => {
        const uid = user?.uid;
        if (!uid) return;
        // Wipe local data first so a partial failure (e.g. Firebase requires
        // recent re-authentication) doesn't leave orphaned receipts behind.
        await Promise.all([deleteAllReceipts(), deleteProfile(uid)]);
        await resetAllSecureStorage();
        setOnboardingSeenState(false);
        setBiometricEnabledState(false);
        setBiometricAskedState(false);
        await deleteCurrentAccount();
        // onAuthStateChanged will fire with null, clearing user + profile.
      },
    }),
    [
      initializing,
      user,
      provider,
      emailVerified,
      requiresProfile,
      profile,
      profileComplete,
      profileLoaded,
      onboardingSeen,
      biometricEnabled,
      biometricAsked,
      biometricUnlocked,
      refreshUser,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
