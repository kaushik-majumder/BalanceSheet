import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { useStyles, useTheme } from '../../constants/theme';

/**
 * Header-right button for the dashboard tab. Shows the user's profile
 * photo if one is uploaded; falls back to the generic person-circle
 * icon otherwise. Tapping always opens the Settings modal.
 */
export function HeaderProfileButton() {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    button: {
      paddingRight: 16,
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    iconWrap: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));
  const { profile } = useAuth();
  const photoUri = profile?.photoUri ?? null;

  return (
    <Pressable
      onPress={() => router.push('/settings' as never)}
      hitSlop={10}
      style={styles.button}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.avatar} />
      ) : (
        <View style={styles.iconWrap}>
          <Ionicons
            name="person-circle-outline"
            size={28}
            color={theme.colors.textPrimary}
          />
        </View>
      )}
    </Pressable>
  );
}
