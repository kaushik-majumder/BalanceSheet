import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Theme, useStyles, useTheme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import {
  GENDERS,
  Gender,
  ProfileDraft,
  ProfileValidationError,
  isProfileValidationClean,
  saveProfile,
  validateProfileDraft,
} from '../lib/profile';
import { pickProfilePhoto } from '../lib/profilePhoto';

export default function ProfileSetupScreen() {
  const { user, profile, setProfile, signOut } = useAuth();
  const theme = useTheme();
  const styles = useStyles(makeStyles);

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [photoUri, setPhotoUri] = useState<string | null>(profile?.photoUri ?? null);
  const [errors, setErrors] = useState<ProfileValidationError>({});
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const choosePhoto = async () => {
    if (!user || pickingPhoto) return;
    try {
      setPickingPhoto(true);
      const uri = await pickProfilePhoto(user.uid);
      if (uri) setPhotoUri(uri);
    } catch (e) {
      Alert.alert('Could not add photo', (e as Error)?.message ?? 'Please try again.');
    } finally {
      setPickingPhoto(false);
    }
  };

  const isEditing = !!profile;

  const submit = async () => {
    if (!user) return;
    const draft: ProfileDraft = { firstName, lastName, gender, age, photoUri };
    const validation = validateProfileDraft(draft);
    setErrors(validation);
    if (!isProfileValidationClean(validation)) return;

    try {
      setSaving(true);
      const saved = await saveProfile(user.uid, draft, profile);
      setProfile(saved);
      // When opened from Settings (editing an existing profile), pop
      // back automatically so the user doesn't get stranded on the
      // form. On first-time setup the route guard handles the next
      // step (verify-email / biometric-setup / tabs).
      if (isEditing && router.canGoBack()) router.back();
    } catch (e) {
      Alert.alert('Could not save profile', (e as Error)?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'Your account stays — you can finish your profile later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isEditing && (
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
            </Pressable>
            <Text style={styles.topBarTitle}>Edit profile</Text>
            <View style={{ width: 32 }} />
          </View>
        )}
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            {!isEditing && (
              <Text style={styles.title}>Tell us about yourself</Text>
            )}
            <Text style={styles.subtitle}>
              {isEditing
                ? 'Update any of your details below.'
                : 'Just a few details so we can personalise your experience.'}
            </Text>
          </View>

          <Pressable onPress={choosePhoto} style={styles.avatarWrap} hitSlop={6}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons
                  name="person-outline"
                  size={48}
                  color={theme.colors.textMuted}
                />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text style={styles.photoHint}>
            {pickingPhoto
              ? 'Opening photo library…'
              : photoUri
                ? 'Tap to change photo'
                : 'Tap to add a photo (optional)'}
          </Text>

          <View style={styles.form}>
            <Field
              label="First name"
              value={firstName}
              onChangeText={(v) => {
                setFirstName(v);
                if (errors.firstName) setErrors({ ...errors, firstName: undefined });
              }}
              placeholder="Jane"
              autoCapitalize="words"
              autoComplete="given-name"
              error={errors.firstName}
            />
            <Field
              label="Last name"
              value={lastName}
              onChangeText={(v) => {
                setLastName(v);
                if (errors.lastName) setErrors({ ...errors, lastName: undefined });
              }}
              placeholder="Doe"
              autoCapitalize="words"
              autoComplete="family-name"
              error={errors.lastName}
            />

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => {
                    setGender(g);
                    if (errors.gender) setErrors({ ...errors, gender: undefined });
                  }}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                >
                  <Text
                    style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}
                  >
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}

            <View style={{ marginTop: theme.spacing.md }}>
              <Field
                label="Age"
                value={age}
                onChangeText={(v) => {
                  setAge(v.replace(/[^0-9]/g, ''));
                  if (errors.age) setErrors({ ...errors, age: undefined });
                }}
                placeholder="28"
                keyboardType="number-pad"
                maxLength={3}
                error={errors.age}
              />
            </View>
          </View>

          <Button
            label={isEditing ? 'Save changes' : 'Save and continue'}
            onPress={submit}
            loading={saving}
            size="lg"
            style={{ marginTop: theme.spacing.lg }}
          />

          {!isEditing && (
            <Pressable
              onPress={handleSignOut}
              hitSlop={8}
              style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}
            >
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  ...input
}: {
  label: string;
  error?: string;
} & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const makeStyles = (t: Theme) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: t.spacing.md,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  topBarTitle: {
    color: t.colors.textPrimary,
    fontSize: t.font.md,
    fontWeight: '700' as const,
  },
  scroll: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.xl,
  },
  header: {
    marginBottom: t.spacing.lg,
  },
  avatarWrap: {
    alignSelf: 'center' as const,
    marginBottom: t.spacing.sm,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: t.colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarEditBadge: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: t.colors.background,
  },
  photoHint: {
    color: t.colors.textMuted,
    fontSize: t.font.xs,
    textAlign: 'center' as const,
    marginBottom: t.spacing.lg,
  },
  title: {
    color: t.colors.textPrimary,
    fontSize: t.font.xxl,
    fontWeight: '700' as const,
    marginBottom: t.spacing.sm,
  },
  subtitle: {
    color: t.colors.textSecondary,
    fontSize: t.font.md,
  },
  form: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    padding: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
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
  inputError: {
    borderColor: t.colors.error,
  },
  errorText: {
    color: t.colors.error,
    fontSize: t.font.xs,
    marginTop: 4,
  },
  genderRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: t.spacing.sm,
    marginBottom: t.spacing.xs,
  },
  genderChip: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: 8,
    borderRadius: t.radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  genderChipActive: {
    backgroundColor: t.colors.primaryFaint,
    borderColor: t.colors.primary,
  },
  genderChipText: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    fontWeight: '600' as const,
  },
  genderChipTextActive: {
    color: t.colors.primary,
  },
  signOut: {
    color: t.colors.textSecondary,
    fontSize: t.font.sm,
    fontWeight: '600' as const,
  },
});
