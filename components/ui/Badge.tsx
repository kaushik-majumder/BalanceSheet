import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Category } from '../../types';
import { useStyles, useTheme } from '../../constants/theme';
import { CATEGORY_ICONS } from '../../constants/categories';

interface Props {
  category: Category;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ category, size = 'md', style }: Props) {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: t.radius.full,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    badgeSm: {
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    icon: {
      fontSize: 12,
    },
    label: {
      fontSize: t.font.sm,
      fontWeight: '600',
    },
    labelSm: {
      fontSize: t.font.xs,
    },
  }));
  const color = theme.colors.category[category];
  const small = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        small && styles.badgeSm,
        { backgroundColor: `${color}22`, borderColor: `${color}55` },
        style,
      ]}
    >
      {!small && <Text style={styles.icon}>{CATEGORY_ICONS[category]}</Text>}
      <Text style={[styles.label, small && styles.labelSm, { color }]}>
        {category}
      </Text>
    </View>
  );
}
