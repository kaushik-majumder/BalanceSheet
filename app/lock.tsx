import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { theme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { authenticateWithBiometric, getBiometricCapability } from '../lib/biometric';
import * as LocalAuthentication from 'expo-local-authentication';

export default function LockScreen() {
  const { user, markBiometricUnlocked, signOut } = useAuth();
  const [authing, setAuthing] = useState(false);
  const [iconName, setIconName] = useState<keyof typeof Ionicons.glyphMap>('finger-print-outline');
  const [label, setLabel] = useState('Unlock with biometric');

  const tryUnlock = async () => {
    if (authing) return;
    setAuthing(true);
    try {
      const ok = await authenticateWithBiometric('Unlock BalanceSheet');
      if (ok) markBiometricUnlocked();
    } finally {
      setAuthing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const cap = await getBiometricCapability();
      if (cap.types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setIconName('happy-outline');
        setLabel('Unlock with Face ID');
      } else if (cap.types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setIconName('eye-outline');
        setLabel('Unlock with iris');
      } else {
        setIconName('finger-print-outline');
        setLabel('Unlock with fingerprint');
      }
    })();
    tryUnlock();
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={iconName} size={72} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</Text>
        <Text style={styles.subtitle}>{label} to continue.</Text>
      </View>

      <View style={styles.footer}>
        <Button label={label} onPress={tryUnlock} loading={authing} size="lg" />
        <Pressable onPress={handleSignOut} hitSlop={8} style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}>
          <Text style={styles.signOut}>Sign out instead</Text>
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
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    textAlign: 'center',
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
