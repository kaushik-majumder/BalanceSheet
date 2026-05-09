import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CategorySummary } from '../../types';
import { theme } from '../../constants/theme';
import { CATEGORY_ICONS } from '../../constants/categories';

interface Props {
  data: CategorySummary[];
}

export function SpendingChart({ data }: Props) {
  if (!data.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No spending data yet</Text>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => b.total - a.total).slice(0, 6);
  const max = sorted[0].total;

  return (
    <View style={styles.container}>
      {sorted.map((item) => {
        const color = theme.colors.category[item.category];
        const barWidth = max > 0 ? (item.total / max) * 100 : 0;

        return (
          <View key={item.category} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.icon}>{CATEGORY_ICONS[item.category]}</Text>
              <Text style={styles.categoryName}>{item.category}</Text>
              <Text style={styles.count}>{item.count}x</Text>
              <Text style={[styles.amount, { color }]}>${item.total.toFixed(2)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${barWidth}%` as any, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.percent}>{item.percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
  },
  row: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  categoryName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '500',
  },
  count: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
  },
  amount: {
    fontSize: theme.font.sm,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'right',
  },
  barTrack: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: theme.radius.full,
    minWidth: 4,
  },
  percent: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    textAlign: 'right',
  },
});
