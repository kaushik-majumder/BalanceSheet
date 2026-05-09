import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import {
  AuthUser,
  configureGoogleSignIn,
  onAuthStateChanged,
  signOutEverywhere,
} from './auth';
import {
  getBiometricAsked,
  getBiometricEnabled,
  getOnboardingSeen,
  setBiometricAsked as persistBiometricAsked,
  setBiometricEnabled as persistBiometricEnabled,
  setOnboardingSeen as persistOnboardingSeen,
} from './secureStorage';

type AuthState = {
  initializing: boolean;
  user: AuthUser | null;
  onboardingSeen: boolean;
  biometricEnabled: boolean;
  biometricAsked: boolean;
  biometricUnlocked: boolean;
  markOnboardingSeen: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  markBiometricAsked: () => Promise<void>;
  markBiometricUnlocked: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [onboardingSeen, setOnboardingSeenState] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAsked, setBiometricAskedState] = useState(false);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);

  useEffect(() => {
    const webClientId =
      (Constants.expoConfig?.extra as any)?.googleWebClientId ??
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

  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      setUser(u);
      if (!u) setBiometricUnlocked(false);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      initializing,
      user,
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
      signOut: async () => {
        // Don't clear biometricUnlocked synchronously — the onAuthStateChanged
        // listener does it when user becomes null. Doing both here causes a
        // race where React renders { user: <old>, biometricUnlocked: false }
        // before the listener fires, briefly routing to the lock screen and
        // triggering the OS biometric prompt.
        await signOutEverywhere();
      },
    }),
    [initializing, user, onboardingSeen, biometricEnabled, biometricAsked, biometricUnlocked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
