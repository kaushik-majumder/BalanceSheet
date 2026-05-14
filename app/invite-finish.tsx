import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '../constants/theme';
import {
  completeEmailLinkSignIn,
  getPendingInviteEmail,
} from '../lib/inviteLink';

/**
 * Completes a Firebase Auth email-link sign-in. AuthContext routes
 * the user here when it detects an incoming `isSignInWithEmailLink`
 * URL. We try the email stashed in SecureStore first (works only on
 * the inviter's own device); otherwise the user enters it manually.
 * On success, Firebase fires onAuthStateChanged and the existing
 * pending-invite check in AuthContext surfaces the accept modal.
 */
export default function InviteFinishScreen() {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background, padding: t.spacing.lg },
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
    input: {
      color: t.colors.textPrimary,
      fontSize: t.font.md,
      backgroundColor: t.colors.surfaceHigh,
      borderRadius: t.radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginTop: t.spacing.lg,
    },
    btn: {
      marginTop: t.spacing.md,
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
    progressText: {
      color: t.colors.textMuted,
      fontSize: t.font.sm,
      textAlign: 'center',
      marginTop: t.spacing.sm,
    },
  }));
  const params = useLocalSearchParams<{ link?: string }>();
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  // Try the stashed email automatically on mount. If it works the
  // user never sees this screen — Firebase signs them in immediately
  // and AuthContext routes them onward.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const link = params.link;
      if (!link) return;
      const stashed = await getPendingInviteEmail();
      if (cancelled) return;
      if (stashed) {
        setEmail(stashed);
        setWorking(true);
        const res = await completeEmailLinkSignIn(stashed, link);
        if (cancelled) return;
        setWorking(false);
        setAutoTried(true);
        if (res.ok) {
          // Auth state change in AuthContext will reroute; we just
          // get out of the way.
          router.replace('/');
        }
      } else {
        setAutoTried(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.link]);

  const handleSubmit = async () => {
    if (!params.link) {
      Alert.alert('Link missing', 'Open the email and tap the invite link again.');
      return;
    }
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter the email that received the invite.');
      return;
    }
    setWorking(true);
    const res = await completeEmailLinkSignIn(trimmed, params.link);
    setWorking(false);
    if (!res.ok) {
      Alert.alert('Sign-in failed', res.reason);
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Text style={styles.title}>Accept your invite</Text>
      <Text style={styles.blurb}>
        Enter the email address that received the invite link. We'll sign you
        in and add you to the family.
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="family@example.com"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!working}
        style={styles.input}
      />
      <Pressable onPress={handleSubmit} disabled={working} style={styles.btn}>
        {working ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Continue</Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => router.replace('/')}
        style={styles.secondaryBtn}
        disabled={working}
      >
        <Text style={styles.secondaryText}>Cancel</Text>
      </Pressable>
      {autoTried && !working ? (
        <Text style={styles.progressText}>
          The email you signed up with should match what you entered above.
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
