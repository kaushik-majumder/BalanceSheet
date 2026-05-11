import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button } from '../components/ui/Button';
import { Theme, useStyles, useTheme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { authenticateWithBiometric, getBiometricCapability } from '../lib/biometric';

export default function BiometricSetupScreen() {
  const { setBiometricEnabled, markBiometricAsked } = useAuth();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
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

const makeStyles = (t: Theme) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  content: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: t.spacing.xl,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primaryFaint,
    marginBottom: t.spacing.xl,
  },
  title: {
    color: t.colors.textPrimary,
    fontSize: t.font.xxl,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: t.spacing.md,
  },
  subtitle: {
    color: t.colors.textSecondary,
    fontSize: t.font.md,
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: t.spacing.md,
  },
  footer: {
    paddingHorizontal: t.spacing.xl,
    paddingBottom: t.spacing.lg,
  },
  skip: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    fontWeight: '600' as const,
  },
});
