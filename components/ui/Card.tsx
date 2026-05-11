import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useStyles } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, style, elevated = false }: Props) {
  const styles = useStyles((t) => ({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 6,
    },
  }));
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}
