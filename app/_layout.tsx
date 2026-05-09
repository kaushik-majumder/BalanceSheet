import 'react-native-get-random-values';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../lib/database';
import { theme } from '../constants/theme';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { pickTarget, targetToHref } from '../lib/routeGuard';

export default function RootLayout() {
  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Segments that the route guard owns and may redirect away from. Anything
 * else (e.g. /settings, /edit/[id], or any future modal route) is treated as
 * "free" — the user explicitly pushed it onto the stack and the guard should
 * leave them alone. Without this allowlist, opening a modal triggers the
 * effect below, which sees target='(tabs)' !== current='settings' and bounces
 * straight back, making the icon appear to do nothing.
 */
const GATED_SEGMENTS = new Set([
  '',
  '(tabs)',
  'onboarding',
  'auth',
  'verify-email',
  'profile-setup',
  'biometric-setup',
  'lock',
]);

function RootStack() {
  const {
    initializing,
    user,
    emailVerified,
    requiresProfile,
    profileComplete,
    onboardingSeen,
    biometricEnabled,
    biometricAsked,
    biometricUnlocked,
  } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;
    const current = segments[0] ?? '';
    if (!GATED_SEGMENTS.has(current)) return;
    const target = pickTarget({
      user,
      onboardingSeen,
      emailVerified,
      requiresProfile,
      profileComplete,
      biometricEnabled,
      biometricAsked,
      biometricUnlocked,
    });
    if (target !== current) {
      router.replace(targetToHref(target) as never);
    }
  }, [
    initializing,
    user,
    emailVerified,
    requiresProfile,
    profileComplete,
    onboardingSeen,
    biometricEnabled,
    biometricAsked,
    biometricUnlocked,
    segments,
  ]);

  if (initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: { fontWeight: '700', color: theme.colors.textPrimary },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="verify-email" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile-setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="biometric-setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="lock" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.colors.surface },
        }}
      />
      <Stack.Screen
        name="edit/[id]"
        options={{
          title: 'Edit Receipt',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.colors.surface },
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
