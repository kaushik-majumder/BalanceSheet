import React from 'react';
import { View, Text } from 'react-native';
import { Category, MonthlyStats } from '../../types';
import { useStyles, useTheme } from '../../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../../constants/categories';

interface Props {
  stats: MonthlyStats;
}

export function StatsRow({ stats }: Props) {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    row: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    card: {
      flex: 1,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      padding: t.spacing.sm + 2,
      borderTopWidth: 3,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    value: {
      fontSize: t.font.md,
      fontWeight: '700',
      marginBottom: 2,
    },
    label: {
      color: t.colors.textPrimary,
      fontSize: t.font.xs,
      fontWeight: '500',
    },
    sub: {
      color: t.colors.textMuted,
      fontSize: t.font.xs,
    },
  }));
  const top = stats.topCategory;
  const standardTop =
    top && (ALL_CATEGORIES as readonly string[]).includes(top)
      ? (top as Category)
      : null;
  const topIcon = standardTop ? CATEGORY_ICONS[standardTop] : '🏷️';
  const topColor = standardTop
    ? theme.colors.category[standardTop]
    : top
      ? theme.colors.primary
      : theme.colors.textMuted;

  const items = [
    {
      label: 'Receipts',
      value: stats.receiptCount.toString(),
      sub: 'scanned',
      color: theme.colors.info,
    },
    {
      label: 'Avg / Receipt',
      value: `$${stats.avgPerReceipt.toFixed(2)}`,
      sub: 'per visit',
      color: theme.colors.warning,
    },
    {
      label: 'Top Category',
      value: top ? `${topIcon} ${top}` : '—',
      sub: 'most spent',
      color: topColor,
    },
  ];

  return (
    <View style={styles.row}>
      {items.map((item, idx) => (
        <View key={idx} style={[styles.card, { borderTopColor: item.color }]}>
          <Text style={[styles.value, { color: item.color }]} numberOfLines={1}>
            {item.value}
          </Text>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.sub}>{item.sub}</Text>
        </View>
      ))}
    </View>
  );
}
