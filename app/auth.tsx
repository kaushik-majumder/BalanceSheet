import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Theme, useStyles, useTheme } from '../constants/theme';
import {
  ConfirmationResult,
  confirmPhoneCode,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signInWithPhone,
  signUpWithEmail,
} from '../lib/auth';
import { humanizeAuthError } from '../lib/authErrors';

type Tab = 'email' | 'phone' | 'google';

export default function AuthScreen() {
  const [tab, setTab] = useState<Tab>('email');
  const styles = useStyles(makeStyles);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>BalanceSheet</Text>
            <Text style={styles.tagline}>Sign in to keep every receipt in sync.</Text>
          </View>

          <View style={styles.tabs}>
            <TabButton label="Email" active={tab === 'email'} onPress={() => setTab('email')} icon="mail-outline" />
            <TabButton label="Phone" active={tab === 'phone'} onPress={() => setTab('phone')} icon="call-outline" />
            <TabButton label="Google" active={tab === 'google'} onPress={() => setTab('google')} icon="logo-google" />
          </View>

          <View style={styles.formWrap}>
            {tab === 'email' && <EmailForm />}
            {tab === 'phone' && <PhoneForm />}
            {tab === 'google' && <GoogleForm />}
          </View>

          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? theme.colors.primary : theme.colors.textSecondary}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmailForm() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Email and password are required.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    try {
      setLoading(true);
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (e: any) {
      Alert.alert('Authentication failed', humanizeError(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email first', 'We need an email to send the reset link to.');
      return;
    }
    try {
      await sendPasswordReset(email);
      Alert.alert('Reset link sent', 'Check your inbox to set a new password.');
    } catch (e: any) {
      Alert.alert('Could not send reset', humanizeError(e));
    }
  };

  return (
    <View>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
      />

      <Button
        label={mode === 'signin' ? 'Sign in' : 'Create account'}
        onPress={submit}
        loading={loading}
        size="lg"
        style={{ marginTop: theme.spacing.md }}
      />

      <View style={styles.linkRow}>
        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} hitSlop={8}>
          <Text style={styles.link}>
            {mode === 'signin' ? 'Create an account' : 'I already have an account'}
          </Text>
        </Pressable>
        {mode === 'signin' && (
          <Pressable onPress={reset} hitSlop={8}>
            <Text style={styles.linkMuted}>Forgot password?</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PhoneForm() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed.startsWith('+')) {
      Alert.alert('Use international format', 'Phone must start with country code, e.g. +14155551234');
      return;
    }
    try {
      setLoading(true);
      const result = await signInWithPhone(trimmed);
      setConfirmation(result);
    } catch (e: any) {
      Alert.alert('Could not send code', humanizeError(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!confirmation) return;
    if (code.trim().length < 4) {
      Alert.alert('Enter the code', 'Check your SMS for the 6-digit code.');
      return;
    }
    try {
      setLoading(true);
      await confirmPhoneCode(confirmation, code);
    } catch (e: any) {
      Alert.alert('Verification failed', humanizeError(e));
    } finally {
      setLoading(false);
    }
  };

  if (!confirmation) {
    return (
      <View>
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+14155551234"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <Button
          label="Send code"
          onPress={sendCode}
          loading={loading}
          size="lg"
          style={{ marginTop: theme.spacing.md }}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.helper}>We sent a code to {phone}.</Text>
      <Field
        label="Verification code"
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="sms-otp"
      />
      <Button
        label="Verify"
        onPress={verify}
        loading={loading}
        size="lg"
        style={{ marginTop: theme.spacing.md }}
      />
      <Pressable onPress={() => setConfirmation(null)} hitSlop={8} style={{ marginTop: theme.spacing.md }}>
        <Text style={styles.linkMuted}>Use a different number</Text>
      </Pressable>
    </View>
  );
}

function GoogleForm() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.code === 'SIGN_IN_CANCELLED') return;
      Alert.alert('Google sign-in failed', humanizeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={styles.helper}>
        Continue with your Google account. We only use your email and name.
      </Text>
      <Button
        label="Continue with Google"
        onPress={onPress}
        loading={loading}
        size="lg"
        style={{ marginTop: theme.spacing.md }}
      />
    </View>
  );
}

function Field({
  label,
  ...input
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const humanizeError = humanizeAuthError;

const makeStyles = (t: Theme) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  scroll: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.xl,
  },
  header: {
    alignItems: 'center' as const,
    marginBottom: t.spacing.xl,
  },
  brand: {
    color: t.colors.textPrimary,
    fontSize: t.font.xxxl,
    fontWeight: '700' as const,
    marginBottom: t.spacing.xs,
  },
  tagline: {
    color: t.colors.textSecondary,
    fontSize: t.font.md,
    textAlign: 'center' as const,
  },
  tabs: {
    flexDirection: 'row' as const,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    padding: 4,
    marginBottom: t.spacing.lg,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    borderRadius: t.radius.sm,
  },
  tabBtnActive: {
    backgroundColor: t.colors.primaryFaint,
  },
  tabBtnText: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    fontWeight: '600' as const,
  },
  tabBtnTextActive: {
    color: t.colors.primary,
  },
  formWrap: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    padding: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  field: {
    marginBottom: t.spacing.md,
  },
  fieldLabel: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    fontWeight: '600' as const,
    marginBottom: t.spacing.xs,
  },
  input: {
    backgroundColor: t.colors.background,
    color: t.colors.textPrimary,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    fontSize: t.font.md,
  },
  linkRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: t.spacing.md,
  },
  link: {
    color: t.colors.primary,
    fontSize: t.font.sm,
    fontWeight: '600' as const,
  },
  linkMuted: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    fontWeight: '500' as const,
  },
  helper: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    marginBottom: t.spacing.md,
    lineHeight: 20,
  },
  legal: {
    color: t.colors.textMuted,
    fontSize: t.font.xs,
    textAlign: 'center' as const,
    marginTop: t.spacing.lg,
    paddingHorizontal: t.spacing.md,
    lineHeight: 16,
  },
});
