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
 * Routes the user reaches voluntarily (modals, edit screens). When `target`
 * resolves to `(tabs)` and the user is on one of these, leave them alone —
 * the guard's job is to FORCE users to gate screens (auth, verify-email,
 * etc.), not to drag them back to /(tabs) every time they open a modal.
 *
 * Note: profile-setup lives here too because it's reused as an "edit
 * profile" destination from settings. When required at first sign-in,
 * pickTarget returns 'profile-setup' — so we still navigate there. When
 * voluntary, pickTarget returns '(tabs)' and we should leave them be.
 */
const STICKY_VOLUNTARY = new Set(['settings', 'edit', 'profile-setup']);

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
    if (target === current) return;
    // User is on a voluntary screen (modal / edit) and the gate state says
    // they're cleared for the app — leave them on it. Do still redirect if
    // target is anything other than (tabs) (e.g. they signed out and
    // need to land on /auth).
    if (target === '(tabs)' && STICKY_VOLUNTARY.has(current)) return;
    router.replace(targetToHref(target) as never);
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
