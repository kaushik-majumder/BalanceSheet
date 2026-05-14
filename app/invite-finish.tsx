import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { signOutEverywhere, signUpWithEmail } from '../lib/auth';
import { humanizeAuthError } from '../lib/authErrors';
import {
  acceptInvite,
  getPendingInviteForEmail,
  type PendingInvite,
} from '../lib/cloudSync';

/**
 * Invite-acceptance signup screen. Reached when the OS opens a verified
 * app-link of shape `https://<host>/invite?email=<encoded>`.
 *
 * Flow for a brand-new invitee:
 *   1. Look up the Firestore invite doc by email — shows who invited
 *      them and surfaces missing/expired invites as a clear error.
 *   2. Collect display name + password (+ confirm).
 *   3. Suppress AuthContext's auto-bootstrap, then in order:
 *      createUserWithEmailAndPassword → updateProfile(displayName)
 *      → acceptInvite → signOut. The suppress flag prevents
 *      ensureHouseholdForUser from racing in and creating an orphan
 *      solo household before acceptInvite re-points the user.
 *   4. Route to /auth with the email pre-filled and a success
 *      message, so they sign in with their just-set password.
 *
 * The legacy `?link=` query (Firebase magic-link path) is no longer
 * produced by sendInviteEmailLink — we route any stragglers to the
 * same error UI so users aren't stuck on a blank screen.
 */
export default function InviteFinishScreen() {
  const theme = useTheme();
  const { setSuppressBootstrap } = useAuth();
  const params = useLocalSearchParams<{ email?: string; link?: string }>();
  const inviteEmail = (params.email ?? '').trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: t.spacing.lg, paddingBottom: t.spacing.xl },
    title: {
      color: t.colors.textPrimary,
      fontSize: t.font.xl,
      fontWeight: '700',
      marginTop: t.spacing.lg,
    },
    blurb: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      marginTop: t.spacing.sm,
      lineHeight: 20,
    },
    invitedBy: {
      marginTop: t.spacing.lg,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    invitedByLabel: {
      color: t.colors.textMuted,
      fontSize: t.font.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    invitedByValue: {
      color: t.colors.textPrimary,
      fontSize: t.font.md,
      fontWeight: '600',
      marginTop: 4,
    },
    invitedHousehold: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      marginTop: 2,
    },
    label: {
      color: t.colors.textSecondary,
      fontSize: t.font.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: t.spacing.lg,
    },
    input: {
      color: t.colors.textPrimary,
      fontSize: t.font.md,
      backgroundColor: t.colors.surfaceHigh,
      borderRadius: t.radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginTop: t.spacing.sm,
    },
    inputReadOnly: {
      opacity: 0.7,
    },
    btn: {
      marginTop: t.spacing.lg,
      backgroundColor: t.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: t.radius.full,
      alignItems: 'center',
    },
    btnText: {
      color: '#fff',
      fontSize: t.font.md,
      fontWeight: '700',
    },
    secondaryBtn: {
      marginTop: t.spacing.sm,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryText: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      fontWeight: '600',
    },
    errorTitle: {
      color: t.colors.textPrimary,
      fontSize: t.font.lg,
      fontWeight: '700',
      marginTop: t.spacing.lg,
    },
    errorBody: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      marginTop: t.spacing.sm,
      lineHeight: 20,
    },
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!inviteEmail) {
        if (cancelled) return;
        setError(
          params.link
            ? "This invite link is from an older version. Ask the sender to invite you again — they'll get a fresh link."
            : 'No invite email in this link. Ask the sender to resend the invite.',
        );
        setLoading(false);
        return;
      }
      const found = await getPendingInviteForEmail(inviteEmail);
      if (cancelled) return;
      if (!found) {
        setError(
          'This invite is expired or has already been used. Ask the sender to resend the invite.',
        );
        setLoading(false);
        return;
      }
      setInvite(found);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteEmail, params.link]);

  const handleSubmit = async () => {
    if (!invite) return;
    const name = displayName.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter the name you want to use.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter both passwords to match.');
      return;
    }

    setSubmitting(true);
    // Suppress AuthContext's auto-bootstrap so it doesn't race ahead of
    // acceptInvite and create an orphan solo household for the new uid.
    setSuppressBootstrap(true);
    try {
      const newUser = await signUpWithEmail(inviteEmail, password);
      // Best-effort displayName update. If this fails the user still
      // owns the account; they can fix the name from profile-setup.
      try {
        await newUser.updateProfile({ displayName: name });
      } catch {
        // ignore
      }
      const acceptRes = await acceptInvite({ invite, uid: newUser.uid });
      if (!acceptRes.ok) {
        // Account exists but household join failed. Surface the
        // reason; user can sign in later and the existing pending-
        // invite Alert in AuthContext will retry the accept.
        Alert.alert(
          'Joined household failed',
          `${acceptRes.reason}. Your account is created — sign in and try accepting the invite again.`,
        );
      }
      // Route to /auth with the email pre-filled and a success
      // message BEFORE signing out so we land directly on the sign-in
      // screen instead of bouncing through whatever the route guard
      // would otherwise pick.
      router.replace({
        pathname: '/auth' as never,
        params: {
          email: inviteEmail,
          msg: 'Account created. Sign in with your email and password.',
        },
      });
      await signOutEverywhere();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        // User already has an account for this email. Bounce them to
        // /auth with the email pre-filled; signing in will fire the
        // existing pending-invite Alert and accept the invite there.
        router.replace({
          pathname: '/auth' as never,
          params: {
            email: inviteEmail,
            msg: 'You already have an account. Sign in to accept the invite.',
          },
        });
      } else {
        Alert.alert('Signup failed', humanizeAuthError(e));
      }
    } finally {
      setSuppressBootstrap(false);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.blurb, { marginTop: theme.spacing.md }]}>
            Looking up your invite…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !invite) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.errorTitle}>Can't open this invite</Text>
          <Text style={styles.errorBody}>{error ?? 'Unknown error.'}</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.btn}>
            <Text style={styles.btnText}>Continue to app</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const inviterLabel =
    invite.invitedByName ?? invite.invitedByEmail ?? 'A Receipt Scanner user';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Accept your invite</Text>
          <Text style={styles.blurb}>
            Create an account to join the household. Once you finish, sign in
            with your email and password to see everything shared with you.
          </Text>

          <View style={styles.invitedBy}>
            <Text style={styles.invitedByLabel}>Invited by</Text>
            <Text style={styles.invitedByValue}>{inviterLabel}</Text>
            {invite.householdName ? (
              <Text style={styles.invitedHousehold}>
                Household: {invite.householdName}
              </Text>
            ) : null}
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={inviteEmail}
            editable={false}
            style={[styles.input, styles.inputReadOnly]}
          />

          <Text style={styles.label}>Your name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Alex"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            editable={!submitting}
            style={styles.input}
          />

          <Text style={styles.label}>Set a password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={styles.input}
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter the same password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={styles.input}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.btn}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create account & join</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.replace('/')}
            style={styles.secondaryBtn}
            disabled={submitting}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
