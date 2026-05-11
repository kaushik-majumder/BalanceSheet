import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Category } from '../types';
import { useStyles, useTheme } from '../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../constants/categories';
import { getAllReceipts, getReceiptsByMonth } from '../lib/database';
import { format as formatDate } from 'date-fns';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import {
  buildCategoryDrilldown,
  CategoryDrilldownResult,
} from '../lib/categoryDrilldown';

export default function CategoryDetailScreenWrapped() {
  return (
    <ErrorBoundary>
      <CategoryDetailScreen />
    </ErrorBoundary>
  );
}

function CategoryDetailScreen() {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    titleEmoji: {
      fontSize: 18,
    },
    title: {
      fontSize: t.font.lg,
      fontWeight: '700',
    },
    content: {
      padding: t.spacing.md,
      gap: t.spacing.md,
      paddingBottom: t.spacing.xl,
    },
    heroCard: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.lg,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
    },
    heroLabel: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    heroAmount: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: -1,
    },
    heroSub: {
      color: t.colors.textMuted,
      fontSize: t.font.sm,
    },
    groupCard: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: t.spacing.sm,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    storeName: {
      color: t.colors.textPrimary,
      fontSize: t.font.md,
      fontWeight: '700',
    },
    date: {
      color: t.colors.textMuted,
      fontSize: t.font.xs,
      marginTop: 2,
    },
    groupTotal: {
      fontSize: t.font.lg,
      fontWeight: '800',
    },
    itemsList: {
      paddingTop: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      gap: 6,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemName: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      flex: 1,
      marginRight: 8,
    },
    itemAmount: {
      color: t.colors.textPrimary,
      fontSize: t.font.sm,
      fontWeight: '600',
    },
    wholeReceiptHint: {
      color: t.colors.textMuted,
      fontSize: t.font.xs,
      fontStyle: 'italic',
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.xl,
      gap: t.spacing.sm,
    },
    emptyTitle: {
      color: t.colors.textPrimary,
      fontSize: t.font.xl,
      fontWeight: '700',
      marginTop: t.spacing.sm,
    },
    emptyText: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      textAlign: 'center',
      maxWidth: 260,
    },
  }));
  const params = useLocalSearchParams<{
    category?: string;
    year?: string;
    month?: string;
  }>();
  const category: Category | string =
    typeof params.category === 'string' && params.category.length > 0
      ? params.category
      : 'Other';
  const standard = isCategory(category);

  // When the dashboard passes year+month, scope the drilldown to that
  // month so the user sees ONLY the receipts that contributed to the
  // breakdown bar they tapped — not a cross-month rollup of every
  // receipt ever scanned. Falls back to global if absent (e.g.
  // navigation from history or direct deep link).
  const yearNum = params.year ? parseInt(params.year, 10) : null;
  const monthNum = params.month ? parseInt(params.month, 10) : null;
  const scoped = Number.isFinite(yearNum) && Number.isFinite(monthNum);
  const monthLabel = scoped
    ? formatDate(new Date(yearNum!, monthNum! - 1, 1), 'MMMM yyyy')
    : null;

  const [result, setResult] = useState<CategoryDrilldownResult | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const receipts = scoped
          ? await getReceiptsByMonth(yearNum!, monthNum!)
          : await getAllReceipts();
        if (!mounted) return;
        setResult(buildCategoryDrilldown(receipts, category));
        setLoading(false);
      })();
      return () => {
        mounted = false;
      };
    }, [category, yearNum, monthNum, scoped]),
  );

  const accent = standard
    ? theme.colors.category[category as Category]
    : theme.colors.primary;
  const headerIcon = standard ? CATEGORY_ICONS[category as Category] : '🏷️';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.titleEmoji}>{headerIcon}</Text>
          <Text style={[styles.title, { color: accent }]}>{category}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : !result || result.groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="receipt-outline"
            size={52}
            color={theme.colors.textMuted}
          />
          <Text style={styles.emptyTitle}>Nothing in {category} yet</Text>
          <Text style={styles.emptyText}>
            Items you scan that fall under {category} will show here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.heroCard, { borderColor: accent }]}>
            <Text style={styles.heroLabel}>
              {monthLabel
                ? `${category} in ${monthLabel}`
                : `Total in ${category}`}
            </Text>
            <Text style={[styles.heroAmount, { color: accent }]}>
              ${result.totalSpent.toFixed(2)}
            </Text>
            <Text style={styles.heroSub}>
              across {result.groups.length} receipt
              {result.groups.length === 1 ? '' : 's'}
            </Text>
          </View>

          {result.groups.map((g) => (
            <Pressable
              key={g.receiptId}
              onPress={() => router.push(`/edit/${g.receiptId}` as never)}
              style={({ pressed }) => [
                styles.groupCard,
                pressed && { backgroundColor: theme.colors.surfaceHigh },
              ]}
            >
              <View style={styles.groupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {g.storeName}
                  </Text>
                  <Text style={styles.date}>
                    {format(new Date(g.date), 'MMM d, yyyy')}
                  </Text>
                </View>
                <Text style={[styles.groupTotal, { color: accent }]}>
                  ${g.subtotal.toFixed(2)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.textMuted}
                />
              </View>

              {g.isWholeReceipt ? (
                <Text style={styles.wholeReceiptHint}>
                  Whole receipt — no item-level breakdown saved
                </Text>
              ) : (
                <View style={styles.itemsList}>
                  {g.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemAmount}>
                        ${item.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' &&
    (ALL_CATEGORIES as readonly string[]).includes(value)
  );
}

