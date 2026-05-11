import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, CategorySummary } from '../../types';
import { useStyles, useTheme } from '../../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../../constants/categories';

interface Props {
  data: CategorySummary[];
  /** Optional click handler. When provided, each row is rendered as a
   *  Pressable with a chevron affordance and forwards the tapped
   *  category. The dashboard wires this to the History tab so users can
   *  drill in to see the receipts that contributed to that slice. */
  onCategoryPress?: (category: Category | string) => void;
}

const isStandardCategory = (c: string): c is Category =>
  (ALL_CATEGORIES as readonly string[]).includes(c);

export function SpendingChart({ data, onCategoryPress }: Props) {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    container: {
      gap: 14,
    },
    empty: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      color: t.colors.textMuted,
      fontSize: t.font.sm,
    },
    row: {
      gap: 6,
    },
    rowPressable: {
      paddingVertical: 4,
      paddingHorizontal: 4,
      marginHorizontal: -4,
      borderRadius: t.radius.sm,
    },
    rowPressed: {
      backgroundColor: t.colors.surfaceHigh,
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
      color: t.colors.textPrimary,
      fontSize: t.font.sm,
      fontWeight: '500',
    },
    count: {
      color: t.colors.textMuted,
      fontSize: t.font.xs,
    },
    amount: {
      fontSize: t.font.sm,
      fontWeight: '700',
      minWidth: 72,
      textAlign: 'right',
    },
    chevron: {
      marginLeft: 4,
    },
    barTrack: {
      height: 8,
      backgroundColor: t.colors.border,
      borderRadius: t.radius.full,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%' as `${number}%`,
      borderRadius: t.radius.full,
      minWidth: 4,
    },
    percent: {
      color: t.colors.textMuted,
      fontSize: t.font.xs,
      textAlign: 'right',
    },
  }));
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
        const standard = isStandardCategory(item.category);
        const color = standard
          ? theme.colors.category[item.category as Category]
          : theme.colors.primary;
        const icon = standard ? CATEGORY_ICONS[item.category as Category] : '🏷️';
        const barWidth = max > 0 ? (item.total / max) * 100 : 0;
        const RowContent = (
          <>
            <View style={styles.labelRow}>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.categoryName}>{item.category}</Text>
              <Text style={styles.count}>{item.count}x</Text>
              <Text style={[styles.amount, { color }]}>
                ${item.total.toFixed(2)}
              </Text>
              {onCategoryPress && (
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={theme.colors.textMuted}
                  style={styles.chevron}
                />
              )}
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${barWidth}%` as `${number}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.percent}>{item.percentage.toFixed(0)}%</Text>
          </>
        );

        if (onCategoryPress) {
          return (
            <Pressable
              key={item.category}
              onPress={() => onCategoryPress(item.category)}
              style={({ pressed }) => [
                styles.row,
                styles.rowPressable,
                pressed && styles.rowPressed,
              ]}
            >
              {RowContent}
            </Pressable>
          );
        }
        return (
          <View key={item.category} style={styles.row}>
            {RowContent}
          </View>
        );
      })}
    </View>
  );
}
