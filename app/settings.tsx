import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { humanizeAuthError } from '../lib/authErrors';

export default function SettingsScreen() {
  const { user, profile, provider, biometricEnabled, setBiometricEnabled, signOut, deleteAccount } =
    useAuth();
  const [working, setWorking] = useState(false);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      "This permanently deletes your profile, all scanned receipts, and your sign-in. " +
        "If you sign up again, you'll start fresh — nothing carries over.\n\nThis cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: doDelete,
        },
      ],
    );
  };

  const doDelete = async () => {
    if (working) return;
    try {
      setWorking(true);
      await deleteAccount();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        Alert.alert(
          'Please sign in again',
          'For security, deleting an account requires a recent sign-in. Sign out and sign back in, then try again.',
          [{ text: 'OK', onPress: () => signOut() }],
        );
        return;
      }
      Alert.alert('Could not delete account', humanizeAuthError(e));
    } finally {
      setWorking(false);
    }
  };

  const editProfile = () => {
    router.push('/profile-setup' as never);
  };

  const toggleBiometric = async () => {
    try {
      await setBiometricEnabled(!biometricEnabled);
    } catch (e) {
      Alert.alert('Could not update', humanizeAuthError(e));
    }
  };

  const providerLabel =
    provider === 'password'
      ? 'Email & password'
      : provider === 'phone'
        ? 'Phone number'
        : provider === 'google.com'
          ? 'Google'
          : 'Other';

  const identity =
    user?.email ?? user?.phoneNumber ?? user?.displayName ?? 'Signed in';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Profile">
          {profile ? (
            <>
              <View style={styles.profileHeader}>
                {profile.photoUri ? (
                  <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons
                      name="person-outline"
                      size={28}
                      color={theme.colors.textMuted}
                    />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {profile.firstName} {profile.lastName}
                  </Text>
                  <Text style={styles.profileMeta} numberOfLines={1}>
                    {profile.gender} · {profile.age}
                  </Text>
                </View>
              </View>
              <Pressable onPress={editProfile} style={styles.linkRow}>
                <Text style={styles.linkText}>Edit profile</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </Pressable>
            </>
          ) : (
            <Pressable onPress={editProfile} style={styles.linkRow}>
              <Text style={styles.linkText}>Add profile details</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
            </Pressable>
          )}
        </Section>

        <Section title="Account">
          <Row label="Signed in with" value={providerLabel} />
          <Row label="Identity" value={identity} />
        </Section>

        <Section title="Security">
          <Pressable onPress={toggleBiometric} style={styles.linkRow}>
            <Text style={styles.linkText}>
              Biometric unlock: {biometricEnabled ? 'On' : 'Off'}
            </Text>
            <Ionicons
              name={biometricEnabled ? 'toggle' : 'toggle-outline'}
              size={28}
              color={biometricEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </Pressable>
        </Section>

        <View style={styles.dangerZone}>
          <Pressable onPress={confirmSignOut} style={styles.signOutBtn} hitSlop={4}>
            <Ionicons name="log-out-outline" size={18} color={theme.colors.textPrimary} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            style={[styles.deleteBtn, working && { opacity: 0.5 }]}
            disabled={working}
            hitSlop={4}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            <Text style={styles.deleteText}>
              {working ? 'Deleting…' : 'Delete account & data'}
            </Text>
          </Pressable>
          <Text style={styles.deleteHelp}>
            Permanently removes your sign-in, profile, and all receipts on this device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
  },
  rowValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '600',
    maxWidth: '60%',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.font.md,
    fontWeight: '600',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  profileMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    marginTop: 2,
  },
  dangerZone: {
    marginTop: theme.spacing.md,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  signOutText: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  deleteText: {
    color: theme.colors.error,
    fontSize: theme.font.md,
    fontWeight: '700',
  },
  deleteHelp: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    lineHeight: 16,
  },
});
