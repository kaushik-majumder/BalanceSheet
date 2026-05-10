import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { theme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { sendVerificationEmail } from '../lib/auth';
import { humanizeAuthError } from '../lib/authErrors';

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmailScreen() {
  const { user, refreshUser, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendIn(RESEND_COOLDOWN_S);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendIn((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  // When the user comes back to the app (e.g. from their mail client), re-check.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkVerified();
    });
    return () => sub.remove();
  }, []);

  const checkVerified = async () => {
    if (checking) return;
    try {
      setChecking(true);
      const u = await refreshUser();
      if (u && !u.emailVerified) {
        // Stay here; route guard will keep us if not verified.
      }
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    if (resending || resendIn > 0) return;
    try {
      setResending(true);
      await sendVerificationEmail();
      startCooldown();
      Alert.alert('Email sent', 'Check your inbox for the verification link.');
    } catch (e) {
      Alert.alert('Could not send email', humanizeAuthError(e));
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can come back any time to verify your email.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={64} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{' '}
          <Text style={styles.email}>{user?.email ?? 'your email'}</Text>. Tap it,
          then come back here.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="I've verified — continue" onPress={checkVerified} loading={checking} size="lg" />
        <Button
          label={resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend verification email'}
          onPress={resend}
          loading={resending}
          disabled={resendIn > 0}
          variant="secondary"
          size="lg"
          style={{ marginTop: theme.spacing.md }}
        />
        <Pressable
          onPress={handleSignOut}
          hitSlop={8}
          style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryFaint,
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
  },
  email: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  signOut: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
});
