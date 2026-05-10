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
import { theme } from '../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../constants/categories';
import { getAllReceipts } from '../lib/database';
import {
  buildCategoryDrilldown,
  CategoryDrilldownResult,
} from '../lib/categoryDrilldown';

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = isCategory(params.category) ? params.category : 'Other';

  const [result, setResult] = useState<CategoryDrilldownResult | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const receipts = await getAllReceipts();
        if (!mounted) return;
        setResult(buildCategoryDrilldown(receipts, category));
        setLoading(false);
      })();
      return () => {
        mounted = false;
      };
    }, [category]),
  );

  const accent = theme.colors.category[category];

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.titleEmoji}>{CATEGORY_ICONS[category]}</Text>
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
            <Text style={styles.heroLabel}>Total in {category}</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
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
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  heroLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
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
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
  },
  groupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '700',
  },
  date: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    marginTop: 2,
  },
  groupTotal: {
    fontSize: theme.font.lg,
    fontWeight: '800',
  },
  itemsList: {
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    flex: 1,
    marginRight: 8,
  },
  itemAmount: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
  wholeReceiptHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    fontStyle: 'italic',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
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
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xl,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    textAlign: 'center',
    maxWidth: 260,
  },
});
