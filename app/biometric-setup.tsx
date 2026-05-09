import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button } from '../components/ui/Button';
import { theme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { authenticateWithBiometric, getBiometricCapability } from '../lib/biometric';

export default function BiometricSetupScreen() {
  const { setBiometricEnabled, markBiometricAsked } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [methodLabel, setMethodLabel] = useState('biometric');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const cap = await getBiometricCapability();
      const enabled = cap.available && cap.enrolled;
      setAvailable(enabled);
      if (cap.types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setMethodLabel('Face ID');
      } else if (cap.types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setMethodLabel('iris');
      } else {
        setMethodLabel('fingerprint');
      }
      if (!enabled) {
        // No biometric on device — silently mark asked and skip.
        await markBiometricAsked();
      }
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const ok = await authenticateWithBiometric(`Confirm ${methodLabel} to enable quick unlock`);
      if (!ok) {
        Alert.alert('Could not verify', 'Try again or skip for now.');
        return;
      }
      await setBiometricEnabled(true);
      await markBiometricAsked();
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await markBiometricAsked();
  };

  if (available === false) {
    // No-op screen — markBiometricAsked above will route us out.
    return <SafeAreaView style={styles.container} edges={['top', 'bottom']} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="finger-print" size={72} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Unlock with {methodLabel}?</Text>
        <Text style={styles.subtitle}>
          Skip the password every time you open BalanceSheet. We never share your{' '}
          {methodLabel} — it stays on your device.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label={`Enable ${methodLabel}`} onPress={enable} loading={busy} size="lg" />
        <Pressable
          onPress={skip}
          hitSlop={8}
          style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}
        >
          <Text style={styles.skip}>Not now</Text>
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
    width: 160,
    height: 160,
    borderRadius: 80,
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
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  skip: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
});
