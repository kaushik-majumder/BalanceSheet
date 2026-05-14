import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
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
import {
  deleteAllReceipts,
  getAllReceipts,
  getCurrentHouseholdId,
  setCurrentHouseholdId,
  setCurrentUserId,
} from './database';
import {
  acceptInvite,
  declineInvite,
  deleteCloudUserData,
  ensureHouseholdForUser,
  getPendingInviteForEmail,
  migrateLocalReceiptsToCloud,
  subscribeToHouseholdReceipts,
} from './cloudSync';
import { isFirebaseEmailLink, parseInviteAppLink } from './inviteLink';
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
  /**
   * Toggle suppression of the post-auth household bootstrap. Used by
   * the invite-signup flow which creates the user, accepts the invite
   * directly, then signs out — all without wanting AuthContext to race
   * in with ensureHouseholdForUser and create an orphan solo household.
   * Set BEFORE createUserWithEmailAndPassword and unset AFTER signOut.
   */
  setSuppressBootstrap: (suppressed: boolean) => void;
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

  // Phase 3: track the active receipts listener so we can tear it down
  // on sign-out / household change before re-subscribing. Without this
  // we'd accumulate orphaned listeners every time the user signs in.
  const receiptsUnsubRef = useRef<(() => void) | null>(null);
  const tearDownReceiptsListener = useCallback(() => {
    if (receiptsUnsubRef.current) {
      receiptsUnsubRef.current();
      receiptsUnsubRef.current = null;
    }
  }, []);
  // Avoid re-prompting on every auth state echo. Firebase fires the
  // listener multiple times for token refresh, focus changes, etc.;
  // we only want the invite dialog shown once per session.
  const invitePromptedForUidRef = useRef<string | null>(null);
  // While true the auth-state listener skips ensureHouseholdForUser
  // + pending-invite Alert. The invite-signup screen sets this so it
  // can run its own acceptInvite + signOut without AuthContext racing
  // in and creating a stray solo household for the just-created uid.
  const suppressBootstrapRef = useRef(false);

  // Invite app-links: when the invitee taps the link in their email
  // the OS opens the app via the verified app-link config. We parse
  // the URL for the invited email and hand off to the finish screen.
  // Falls back to the legacy isFirebaseEmailLink check for any older
  // emails still floating around — that path is now inert (we no
  // longer send Firebase magic links) but harmless.
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const parsed = parseInviteAppLink(url);
      if (parsed) {
        // Cast — expo-router's typed-routes table is generated from a
        // build step that hasn't seen the new app/invite-finish.tsx yet.
        router.push({
          pathname: '/invite-finish' as never,
          params: { email: parsed.email },
        });
        return;
      }
      if (isFirebaseEmailLink(url)) {
        router.push({
          pathname: '/invite-finish' as never,
          params: { link: url },
        });
      }
    };

    // Catch URLs received while the app is open.
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    // Catch URLs that launched the app from a cold start.
    Linking.getInitialURL()
      .then((u) => handleUrl(u))
      .catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (u) => {
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

      // Phase 2 cloud sync: ensure the user has a household in
      // Firestore + push the household id into the DB layer so every
      // shadow-write knows where to land. ensureHouseholdForUser is
      // defensive — it returns null when Firestore isn't enabled or
      // not installed in the running APK, so the rest of the app
      // continues to work in local-only mode.
      // Tear down any previous user's receipts listener before we
      // potentially bootstrap a new household and subscribe again.
      tearDownReceiptsListener();

      // Invite-signup flow disables this branch while it does its own
      // acceptInvite + signOut. Without the gate, ensureHouseholdFor-
      // User would race and create a solo household for the brand-new
      // uid, leaving an orphan after acceptInvite re-points the user.
      if (suppressBootstrapRef.current) {
        return;
      }

      if (u?.uid) {
        const hid = await ensureHouseholdForUser({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
        });
        setCurrentHouseholdId(hid);
        // One-shot backfill of every pre-existing local receipt into
        // the new household. Runs in the background — fully fire-
        // and-forget; the marker in SecureStore prevents repeats.
        if (hid) {
          void migrateLocalReceiptsToCloud({
            uid: u.uid,
            householdId: hid,
            loadAllReceipts: getAllReceipts,
          });
          // Phase 3: start mirroring cloud → local SQLite. Any
          // change to this household's receipts (from THIS device or
          // any other family member) flows in here. The unsubscribe
          // closure is held so the next auth state change can clean it
          // up before re-subscribing.
          const unsubReceipts = subscribeToHouseholdReceipts(hid, u.uid);
          if (unsubReceipts) receiptsUnsubRef.current = unsubReceipts;

          // Phase 3: check for a pending invite addressed to this
          // user's email. Once-per-session gate via the ref so a
          // token refresh doesn't re-fire the prompt.
          if (invitePromptedForUidRef.current !== u.uid) {
            invitePromptedForUidRef.current = u.uid;
            void (async () => {
              const invite = await getPendingInviteForEmail(u.email);
              if (!invite) return;
              const inviter =
                invite.invitedByName ?? invite.invitedByEmail ?? 'Someone';
              Alert.alert(
                "You've been invited to a family",
                `${inviter} invited you to join their household on BalanceSheet. Accepting moves your account to their shared household — you'll see their receipts and they'll see any you scan from now on.`,
                [
                  {
                    text: 'Decline',
                    style: 'cancel',
                    onPress: () => {
                      void declineInvite({ invite });
                    },
                  },
                  {
                    text: 'Accept',
                    onPress: async () => {
                      if (!u.uid) return;
                      const res = await acceptInvite({ invite, uid: u.uid });
                      if (!res.ok) {
                        Alert.alert('Accept failed', res.reason);
                        return;
                      }
                      // Re-bootstrap the household pointers + listener
                      // so the rest of the app immediately sees the
                      // new household's data.
                      tearDownReceiptsListener();
                      setCurrentHouseholdId(res.newHouseholdId);
                      const unsubNew = subscribeToHouseholdReceipts(
                        res.newHouseholdId,
                        u.uid,
                      );
                      if (unsubNew) receiptsUnsubRef.current = unsubNew;
                      Alert.alert(
                        'Joined household',
                        'You now share receipts with the family. Force-close + reopen the app to refresh the dashboard.',
                      );
                    },
                  },
                ],
                { cancelable: false },
              );
            })();
          }
        }
      } else {
        setCurrentHouseholdId(null);
        invitePromptedForUidRef.current = null;
      }
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
        // Wipe CLOUD data first while we still have an authenticated
        // Firebase token. Once deleteCurrentAccount() runs, every
        // Firestore write fails with permission-denied because the
        // rules require an authenticated household member — and we'd
        // leave orphaned receipts, household docs, and pending
        // invites behind that no one can clean up later.
        //
        // deleteCloudUserData handles the solo-vs-shared household
        // distinction internally: solo means we delete the whole
        // household + all its receipts; shared means we just remove
        // ourselves from memberUids so the remaining family keeps
        // their data.
        const householdId = getCurrentHouseholdId();
        try {
          await deleteCloudUserData({
            uid,
            householdId,
            email: user?.email ?? null,
          });
        } catch {
          // Even on cloud-cleanup failure we proceed with local +
          // auth deletion — the user expects the account gone, and
          // any orphaned cloud docs can be manually scrubbed later.
        }
        // Local SQLite wipe.
        await Promise.all([deleteAllReceipts(), deleteProfile(uid)]);
        await resetAllSecureStorage();
        setOnboardingSeenState(false);
        setBiometricEnabledState(false);
        setBiometricAskedState(false);
        // Finally tear down the Firebase Auth account itself.
        await deleteCurrentAccount();
        // onAuthStateChanged will fire with null, clearing user + profile.
      },
      setSuppressBootstrap: (suppressed: boolean) => {
        suppressBootstrapRef.current = suppressed;
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
