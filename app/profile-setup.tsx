import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { Button } from '../components/ui/Button';
import { theme } from '../constants/theme';
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  photoHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xxl,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
  },
  form: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.font.md,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.font.xs,
    marginTop: 4,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  genderChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  genderChipActive: {
    backgroundColor: theme.colors.primaryFaint,
    borderColor: theme.colors.primary,
  },
  genderChipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: theme.colors.primary,
  },
  signOut: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
});
