import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MonthlyStats } from '../../types';
import { theme } from '../../constants/theme';
import { CATEGORY_ICONS } from '../../constants/categories';

interface Props {
  stats: MonthlyStats;
}

export function StatsRow({ stats }: Props) {
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
      value: stats.topCategory
        ? `${CATEGORY_ICONS[stats.topCategory]} ${stats.topCategory}`
        : '—',
      sub: 'most spent',
      color: stats.topCategory ? theme.colors.category[stats.topCategory] : theme.colors.textMuted,
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  value: {
    fontSize: theme.font.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xs,
    fontWeight: '500',
  },
  sub: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
  },
});
