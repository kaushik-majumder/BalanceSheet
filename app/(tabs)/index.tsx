import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths } from 'date-fns';
import { getReceiptsByMonth, deleteReceipt } from '../../lib/database';
import { Receipt, MonthlyStats } from '../../types';
import { theme } from '../../constants/theme';
import { SpendingChart } from '../../components/dashboard/SpendingChart';
import { StatsRow } from '../../components/dashboard/StatsRow';
import { ReceiptCard } from '../../components/receipt/ReceiptCard';
import { Card } from '../../components/ui/Card';
import { computeStats } from '../../lib/dashboardStats';

export default function DashboardScreen() {
  const [activeMonth, setActiveMonth] = useState(new Date());
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stats, setStats] = useState<MonthlyStats>({
    totalSpent: 0,
    receiptCount: 0,
    topCategory: null,
    avgPerReceipt: 0,
    categories: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getReceiptsByMonth(
      activeMonth.getFullYear(),
      activeMonth.getMonth() + 1,
    );
    setReceipts(data);
    setStats(computeStats(data));
  }, [activeMonth]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    await deleteReceipt(id);
    await load();
  };

  const recentReceipts = receipts.slice(0, 5);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Hero total card */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>Total Spent</Text>
        <Text style={styles.heroAmount}>${stats.totalSpent.toFixed(2)}</Text>

        {/* Month navigator */}
        <View style={styles.monthRow}>
          <TouchableOpacity
            onPress={() => setActiveMonth((m) => subMonths(m, 1))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{format(activeMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            onPress={() => setActiveMonth((m) => addMonths(m, 1))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats row */}
      <StatsRow stats={stats} />

      {/* Spending breakdown chart — tap a row to drill into the items
          and per-receipt subtotals for that category. */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Spending Breakdown</Text>
        <SpendingChart
          data={stats.categories}
          onCategoryPress={(category) => {
            router.push({
              pathname: '/category-detail',
              params: { category },
            } as never);
          }}
        />
      </Card>

      {/* Recent transactions */}
      {recentReceipts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.list}>
            {recentReceipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} onDelete={handleDelete} />
            ))}
          </View>
        </View>
      )}

      {receipts.length === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No receipts yet</Text>
          <Text style={styles.emptyText}>
            Tap the camera button to scan your first receipt
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: theme.font.sm,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroAmount: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  monthLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: theme.font.md,
    fontWeight: '600',
    minWidth: 140,
    textAlign: 'center',
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  list: {
    gap: theme.spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxl,
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
    maxWidth: 240,
  },
});
