import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { humanizeAuthError } from '../lib/authErrors';
import { classifyWithAnthropic } from '../lib/anthropicClassify';
import {
  getAiClassifyEnabled,
  getAnthropicApiKey,
  getGeminiApiKey,
  setAiClassifyEnabled,
  setAnthropicApiKey,
  setGeminiApiKey,
} from '../lib/secureStorage';
import { parseReceiptWithGemini } from '../lib/geminiParseReceipt';
import {
  getCloudSyncDiagnostics,
  subscribeCloudSyncDiagnostics,
} from '../lib/cloudSync';

function useSettingsStyles() {
  return useStyles((theme) => ({
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
    keyBlock: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    keyLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.font.xs,
      fontWeight: '600',
      marginBottom: 6,
    },
    keyRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    keyInput: {
      flex: 1,
      backgroundColor: theme.colors.background,
      color: theme.colors.textPrimary,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: theme.font.sm,
      fontFamily: 'monospace',
    },
    keyButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    keyButton: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm,
      paddingVertical: 10,
    },
    keyButtonGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    keyButtonText: {
      color: '#fff',
      fontSize: theme.font.sm,
      fontWeight: '700',
    },
    keyButtonGhostText: {
      color: theme.colors.textPrimary,
    },
    keyHelp: {
      color: theme.colors.textMuted,
      fontSize: theme.font.xs,
      lineHeight: 16,
      marginTop: theme.spacing.sm,
    },
  }));
}

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useSettingsStyles();
  const { user, profile, provider, biometricEnabled, setBiometricEnabled, signOut, deleteAccount } =
    useAuth();
  const [working, setWorking] = useState(false);

  const [aiEnabled, setAiEnabledState] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  const [geminiKey, setGeminiKeyState] = useState('');
  const [geminiVisible, setGeminiVisible] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [stored, enabled, gemini] = await Promise.all([
        getAnthropicApiKey(),
        getAiClassifyEnabled(),
        getGeminiApiKey(),
      ]);
      if (!mounted) return;
      setApiKeyState(stored ?? '');
      setAiEnabledState(enabled);
      setGeminiKeyState(gemini ?? '');
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleAi = async () => {
    if (!aiEnabled && !apiKey.trim()) {
      Alert.alert(
        'Add your API key first',
        'Paste an Anthropic API key below, then turn this on.',
      );
      return;
    }
    const next = !aiEnabled;
    await setAiClassifyEnabled(next);
    setAiEnabledState(next);
  };

  const saveKey = async () => {
    setSavingKey(true);
    try {
      await setAnthropicApiKey(apiKey.trim() || null);
      Alert.alert(
        apiKey.trim() ? 'Key saved' : 'Key removed',
        apiKey.trim()
          ? 'Stored on this device only. It never appears in the app bundle.'
          : 'Anthropic key cleared from this device.',
      );
    } catch (e) {
      Alert.alert('Could not save key', (e as Error)?.message ?? 'Try again.');
    } finally {
      setSavingKey(false);
    }
  };

  const testKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Add a key first', 'Paste an Anthropic API key, save it, then test.');
      return;
    }
    setTestingKey(true);
    try {
      const result = await classifyWithAnthropic('Organic Whole Milk 2%', apiKey.trim());
      if (result.ok) {
        Alert.alert(
          'Connection works',
          `Anthropic classified "Organic Whole Milk 2%" as ${result.category}.`,
        );
      } else {
        Alert.alert('Connection failed', result.error);
      }
    } finally {
      setTestingKey(false);
    }
  };

  const saveGeminiKey = async () => {
    setSavingGemini(true);
    try {
      await setGeminiApiKey(geminiKey.trim() || null);
      Alert.alert(
        geminiKey.trim() ? 'Gemini key saved' : 'Gemini key removed',
        geminiKey.trim()
          ? 'Stored encrypted on this device only. Used for full-receipt parsing instead of the shared free tier.'
          : 'Gemini key cleared — scans will go back to the shared free tier / Cloudflare fallback.',
      );
    } catch (e) {
      Alert.alert('Could not save key', (e as Error)?.message ?? 'Try again.');
    } finally {
      setSavingGemini(false);
    }
  };

  const testGeminiKey = async () => {
    if (!geminiKey.trim()) {
      Alert.alert('Add a key first', 'Paste a Gemini API key, save it, then test.');
      return;
    }
    setTestingGemini(true);
    try {
      const result = await parseReceiptWithGemini(
        'TEST STORE\nMILK 3.99\nSUBTOTAL 3.99\nTAX 0.39\nTOTAL 4.38',
        geminiKey.trim(),
      );
      if (result.ok) {
        Alert.alert(
          'Connection works',
          `Gemini parsed a test receipt as ${result.receipt.storeName} for $${result.receipt.totalAmount.toFixed(2)}.`,
        );
      } else {
        Alert.alert('Connection failed', result.error);
      }
    } finally {
      setTestingGemini(false);
    }
  };

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

        <Section title="Receipt parsing (Gemini)">
          <Text style={styles.keyHelp}>
            By default, the app uses a shared Gemini free-tier quota for
            AI receipt parsing. If you scan a lot of receipts and hit "AI
            quota reached", paste your own Gemini key below — it's free
            and gives you 1500 receipts/day on your own quota.
          </Text>
          <View style={styles.keyBlock}>
            <Text style={styles.keyLabel}>Your Gemini API key (optional)</Text>
            <View style={styles.keyRow}>
              <TextInput
                value={geminiKey}
                onChangeText={setGeminiKeyState}
                placeholder="AIza..."
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!geminiVisible}
                style={styles.keyInput}
              />
              <Pressable
                onPress={() => setGeminiVisible((v) => !v)}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={geminiVisible ? 'Hide key' : 'Show key'}
              >
                <Ionicons
                  name={geminiVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            </View>
            <View style={styles.keyButtons}>
              <Pressable
                onPress={saveGeminiKey}
                disabled={savingGemini}
                style={[styles.keyButton, savingGemini && { opacity: 0.5 }]}
              >
                <Text style={styles.keyButtonText}>
                  {savingGemini ? 'Saving…' : 'Save key'}
                </Text>
              </Pressable>
              <Pressable
                onPress={testGeminiKey}
                disabled={testingGemini}
                style={[styles.keyButton, styles.keyButtonGhost, testingGemini && { opacity: 0.5 }]}
              >
                <Text style={[styles.keyButtonText, styles.keyButtonGhostText]}>
                  {testingGemini ? 'Testing…' : 'Test connection'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.keyHelp}>
              Free at aistudio.google.com → Get API key. Stored encrypted
              on this device only; never bundled into the app.
            </Text>
          </View>
        </Section>

        <Section title="AI categorization">
          <Pressable onPress={toggleAi} style={styles.linkRow}>
            <Text style={styles.linkText}>
              Use Anthropic for unknown items: {aiEnabled ? 'On' : 'Off'}
            </Text>
            <Ionicons
              name={aiEnabled ? 'toggle' : 'toggle-outline'}
              size={28}
              color={aiEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </Pressable>
          <View style={styles.keyBlock}>
            <Text style={styles.keyLabel}>Anthropic API key</Text>
            <View style={styles.keyRow}>
              <TextInput
                value={apiKey}
                onChangeText={setApiKeyState}
                placeholder="sk-ant-..."
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!keyVisible}
                style={styles.keyInput}
              />
              <Pressable
                onPress={() => setKeyVisible((v) => !v)}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={keyVisible ? 'Hide key' : 'Show key'}
              >
                <Ionicons
                  name={keyVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            </View>
            <View style={styles.keyButtons}>
              <Pressable
                onPress={saveKey}
                disabled={savingKey}
                style={[styles.keyButton, savingKey && { opacity: 0.5 }]}
              >
                <Text style={styles.keyButtonText}>
                  {savingKey ? 'Saving…' : 'Save key'}
                </Text>
              </Pressable>
              <Pressable
                onPress={testKey}
                disabled={testingKey}
                style={[styles.keyButton, styles.keyButtonGhost, testingKey && { opacity: 0.5 }]}
              >
                <Text style={[styles.keyButtonText, styles.keyButtonGhostText]}>
                  {testingKey ? 'Testing…' : 'Test connection'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.keyHelp}>
              Stored encrypted on this device only — never bundled into the
              app, never sent anywhere except api.anthropic.com. Get a key at
              console.anthropic.com → Settings → API Keys.
            </Text>
          </View>
        </Section>

        <Section title="Cloud sync (debug)">
          <CloudSyncDiagnosticsPanel />
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

/**
 * Live read-out of Phase-2 cloud sync state. Renders the module-load,
 * household-bootstrap, last-receipt-sync, and last-migration status so
 * we can tell from a screenshot whether the native module is linked,
 * whether the bootstrap reached Firestore, and what (if anything)
 * went wrong. Subscribes to the same in-memory diagnostics buffer
 * cloudSync.ts writes to, so the panel updates as events fire — no
 * need to refresh manually.
 */
function CloudSyncDiagnosticsPanel() {
  const theme = useTheme();
  const styles = useSettingsStyles();
  const [diag, setDiag] = useState(getCloudSyncDiagnostics());

  useEffect(() => {
    const refresh = () => setDiag(getCloudSyncDiagnostics());
    const unsub = subscribeCloudSyncDiagnostics(refresh);
    // Pull a fresh snapshot once on mount so the panel reflects the
    // current state if the user opens Settings AFTER bootstrap has
    // already happened.
    refresh();
    return unsub;
  }, []);

  const fmt = (ts: string | undefined) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Row
        label="Firestore module"
        value={diag.moduleAvailable ? 'linked' : 'NOT LINKED (need new APK)'}
      />
      <Row
        label="Storage module"
        value={diag.storageAvailable ? 'linked' : 'not enabled (optional)'}
      />
      <Row label="Household id" value={diag.householdId ?? 'not set'} />
      <Row
        label="Last bootstrap"
        value={
          diag.lastBootstrap
            ? `${diag.lastBootstrap.ok ? 'OK' : 'FAIL'} · ${fmt(diag.lastBootstrap.at)}${
                diag.lastBootstrap.message ? ` · ${diag.lastBootstrap.message}` : ''
              }`
            : 'never ran'
        }
      />
      <Row
        label="Last receipt sync"
        value={
          diag.lastReceiptSync
            ? `${diag.lastReceiptSync.ok ? 'OK' : 'FAIL'} · ${fmt(diag.lastReceiptSync.at)}${
                diag.lastReceiptSync.message ? ` · ${diag.lastReceiptSync.message}` : ''
              }`
            : 'never ran'
        }
      />
      <Row
        label="Last migration"
        value={
          diag.lastMigration
            ? `${diag.lastMigration.migrated} migrated, ${diag.lastMigration.failed} failed · ${fmt(diag.lastMigration.at)}`
            : 'never ran'
        }
      />
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.font.xs,
          marginTop: 6,
          fontStyle: 'italic',
        }}
      >
        Debug-only. Will be removed once cloud sync is stable.
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useSettingsStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useSettingsStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

