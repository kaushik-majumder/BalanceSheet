import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import {
  ALL_CATEGORIES,
  CATEGORY_ICONS,
} from '../constants/categories';
import { getAllReceipts } from '../lib/database';
import {
  MonthBucket,
  MonthOverMonthDelta,
  TopStore,
  monthOverMonthDelta,
  monthlyTrend,
  topStores,
} from '../lib/reports';
import { Receipt, Category } from '../types';

export default function ReportsScreen() {
  const [activeMonth, setActiveMonth] = useState(new Date());
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const all = await getAllReceipts();
        if (!mounted) return;
        setReceipts(all);
        setLoading(false);
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth() + 1;
  const mom: MonthOverMonthDelta | null =
    receipts.length > 0 || !loading
      ? monthOverMonthDelta(receipts, year, month)
      : null;
  const trend: MonthBucket[] = monthlyTrend(receipts, year, month, 6);
  const monthReceipts = receipts.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const stores: TopStore[] = topStores(monthReceipts, 3);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Month navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setActiveMonth((d) => subMonths(d, 1))}
              hitSlop={12}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {format(activeMonth, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveMonth((d) => addMonths(d, 1))}
              hitSlop={12}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Hero — month total + MoM delta */}
          <SummaryCard mom={mom} />

          {/* 6-month trend chart */}
          <Section title="6-month trend">
            <TrendChart
              data={trend}
              activeMonthKey={`${year}-${String(month).padStart(2, '0')}`}
              onBarPress={(b) => {
                setActiveMonth(new Date(b.year, b.month - 1, 1));
              }}
            />
          </Section>

          {/* Top categories — tap to drill into the existing
              category-detail screen scoped to this month. */}
          {mom && mom.thisMonth.categories.length > 0 && (
            <Section title="Top categories">
              {mom.thisMonth.categories.slice(0, 5).map((c) => {
                const standard = (ALL_CATEGORIES as readonly string[]).includes(
                  c.category,
                );
                const icon = standard
                  ? CATEGORY_ICONS[c.category as Category]
                  : '🏷️';
                const color = standard
                  ? theme.colors.category[c.category as Category]
                  : theme.colors.primary;
                return (
                  <Pressable
                    key={c.category}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/category-detail',
                        params: {
                          category: c.category,
                          year: String(year),
                          month: String(month),
                        },
                      } as never)
                    }
                  >
                    <Text style={styles.rowIcon}>{icon}</Text>
                    <Text style={styles.rowLabel}>{c.category}</Text>
                    <Text style={[styles.rowAmount, { color }]}>
                      ${c.total.toFixed(2)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </Section>
          )}

          {/* Biggest receipt + biggest item */}
          {mom && (mom.thisMonth.biggestReceipt || mom.thisMonth.biggestItem) && (
            <Section title="Standouts">
              {mom.thisMonth.biggestReceipt && (
                <Pressable
                  style={({ pressed }) => [
                    styles.standoutCard,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() =>
                    router.push(
                      `/edit/${mom.thisMonth.biggestReceipt!.receiptId}` as never,
                    )
                  }
                >
                  <Text style={styles.standoutLabel}>Biggest receipt</Text>
                  <Text style={styles.standoutAmount}>
                    ${mom.thisMonth.biggestReceipt.total.toFixed(2)}
                  </Text>
                  <Text style={styles.standoutSub}>
                    {mom.thisMonth.biggestReceipt.storeName}
                    {' · '}
                    {format(
                      new Date(mom.thisMonth.biggestReceipt.date),
                      'MMM d',
                    )}
                  </Text>
                </Pressable>
              )}
              {mom.thisMonth.biggestItem && (
                <Pressable
                  style={({ pressed }) => [
                    styles.standoutCard,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() =>
                    router.push(
                      `/edit/${mom.thisMonth.biggestItem!.receiptId}` as never,
                    )
                  }
                >
                  <Text style={styles.standoutLabel}>Biggest single item</Text>
                  <Text style={styles.standoutAmount}>
                    ${mom.thisMonth.biggestItem.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.standoutSub} numberOfLines={1}>
                    {mom.thisMonth.biggestItem.itemName}
                    {' · '}
                    {mom.thisMonth.biggestItem.storeName}
                  </Text>
                </Pressable>
              )}
            </Section>
          )}

          {/* Top stores */}
          {stores.length > 0 && (
            <Section title="Top stores">
              {stores.map((s) => (
                <View key={s.storeName} style={styles.row}>
                  <Ionicons
                    name="storefront-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.rowLabel}>{s.storeName}</Text>
                  <Text style={styles.rowMuted}>
                    {s.count}x
                  </Text>
                  <Text style={styles.rowAmount}>${s.total.toFixed(2)}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Empty state */}
          {receipts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="bar-chart-outline"
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptyText}>
                Scan a few receipts and your monthly summary, trends, and
                top categories will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SummaryCard({ mom }: { mom: MonthOverMonthDelta | null }) {
  if (!mom) return null;
  const { thisMonth, delta, deltaPct } = mom;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const deltaColor = isUp
    ? theme.colors.error
    : isDown
      ? theme.colors.primary
      : theme.colors.textMuted;
  const arrow = isUp ? 'arrow-up' : isDown ? 'arrow-down' : 'remove';
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>Total spent</Text>
      <Text style={styles.summaryAmount}>${thisMonth.total.toFixed(2)}</Text>
      <View style={styles.summaryMetaRow}>
        <Text style={styles.summarySub}>
          {thisMonth.receiptCount} receipt{thisMonth.receiptCount === 1 ? '' : 's'}
          {thisMonth.avgPerReceipt > 0
            ? ` · avg $${thisMonth.avgPerReceipt.toFixed(2)}`
            : ''}
        </Text>
      </View>
      <View style={[styles.deltaPill, { borderColor: deltaColor }]}>
        <Ionicons name={arrow} size={14} color={deltaColor} />
        <Text style={[styles.deltaText, { color: deltaColor }]}>
          {delta === 0 && deltaPct == null
            ? 'No data last month'
            : delta === 0
              ? 'Same as last month'
              : `$${Math.abs(delta).toFixed(2)}${
                  deltaPct != null ? ` (${Math.abs(deltaPct * 100).toFixed(0)}%)` : ''
                } vs last month`}
        </Text>
      </View>
    </View>
  );
}

function TrendChart({
  data,
  activeMonthKey,
  onBarPress,
}: {
  data: MonthBucket[];
  activeMonthKey: string;
  onBarPress: (bucket: MonthBucket) => void;
}) {
  const max = Math.max(1, ...data.map((b) => b.total));
  return (
    <View style={styles.trendChart}>
      {data.map((b) => {
        const heightPct = max > 0 ? (b.total / max) * 100 : 0;
        const isActive = b.key === activeMonthKey;
        return (
          <Pressable
            key={b.key}
            onPress={() => onBarPress(b)}
            style={({ pressed }) => [
              styles.trendBarCol,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.trendBarTrack}>
              <View
                style={[
                  styles.trendBarFill,
                  {
                    height: `${heightPct}%` as `${number}%`,
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.primaryFaint,
                  },
                ]}
              />
            </View>
            <Text style={styles.trendBarLabel}>{b.shortLabel}</Text>
            <Text
              style={[
                styles.trendBarAmount,
                isActive && { color: theme.colors.primary, fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              ${b.total > 0 ? b.total.toFixed(0) : '—'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
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
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: 40,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
  },
  monthLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryAmount: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  summaryMetaRow: {
    marginTop: 2,
  },
  summarySub: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
  },
  deltaPill: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  deltaText: {
    fontSize: theme.font.xs,
    fontWeight: '700',
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '700',
  },
  sectionBody: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowIcon: {
    fontSize: 16,
  },
  rowLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '500',
  },
  rowMuted: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
  },
  rowAmount: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'right',
  },
  standoutCard: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    gap: 2,
  },
  standoutLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  standoutAmount: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  standoutSub: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    height: 140,
  },
  trendBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  trendBarTrack: {
    width: '70%',
    height: 90,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  trendBarFill: {
    width: '100%',
    minHeight: 2,
  },
  trendBarLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.xs,
    marginTop: 4,
    fontWeight: '600',
  },
  trendBarAmount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
    textAlign: 'center',
    maxWidth: 280,
  },
});
