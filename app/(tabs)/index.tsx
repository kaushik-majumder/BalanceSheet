import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths } from 'date-fns';
import { getReceiptsByMonth, deleteReceipt } from '../../lib/database';
import { Receipt, MonthlyStats } from '../../types';
import { useStyles, useTheme } from '../../constants/theme';
import { SpendingChart } from '../../components/dashboard/SpendingChart';
import { StatsRow } from '../../components/dashboard/StatsRow';
import { ReceiptCard } from '../../components/receipt/ReceiptCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { computeStats } from '../../lib/dashboardStats';

export default function DashboardScreen() {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: t.spacing.md,
      gap: t.spacing.md,
      paddingBottom: 32,
    },
    heroCard: {
      borderRadius: t.radius.xl,
      padding: t.spacing.xl,
      alignItems: 'center',
      gap: 4,
    },
    heroLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: t.font.sm,
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
      gap: t.spacing.md,
      marginTop: t.spacing.sm,
    },
    monthLabel: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: t.font.md,
      fontWeight: '600',
      minWidth: 140,
      textAlign: 'center',
    },
    section: {
      gap: t.spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: t.colors.textPrimary,
      fontSize: t.font.lg,
      fontWeight: '700',
    },
    reportsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: t.radius.full,
      backgroundColor: `${t.colors.primary}1A`,
    },
    reportsLinkText: {
      color: t.colors.primary,
      fontSize: t.font.xs,
      fontWeight: '700',
    },
    list: {
      gap: t.spacing.sm,
    },
    emptyCard: {
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.xxl,
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
      maxWidth: 240,
    },
  }));
  const [activeMonth, setActiveMonth] = useState(new Date());
  const toast = useToast();
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

  const handleDelete = (id: string) => {
    const target = receipts.find((r) => r.id === id);
    if (!target) return;
    // Optimistically remove from the list; defer DB delete 5s so the
    // user can tap Undo on the toast first.
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    const timer = setTimeout(() => {
      deleteReceipt(id).then(load).catch(() => load());
    }, 5000);
    toast.show({
      message: `Deleted ${target.storeName}`,
      kind: 'success',
      undoLabel: 'Undo',
      onUndo: () => {
        clearTimeout(timer);
        load();
      },
      durationMs: 5000,
    });
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <TouchableOpacity
            onPress={() => router.push('/reports' as never)}
            hitSlop={8}
            style={styles.reportsLink}
          >
            <Ionicons name="stats-chart" size={14} color={theme.colors.primary} />
            <Text style={styles.reportsLinkText}>Reports</Text>
          </TouchableOpacity>
        </View>
        <SpendingChart
          data={stats.categories}
          onCategoryPress={(category) => {
            // Pass the active month so the drilldown shows ONLY the
            // receipts contributing to this month's breakdown bar,
            // not a global cross-month total.
            router.push({
              pathname: '/category-detail',
              params: {
                category,
                year: String(activeMonth.getFullYear()),
                month: String(activeMonth.getMonth() + 1),
              },
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
        <EmptyState
          icon="receipt-outline"
          title="No receipts yet"
          description="Tap the green camera button below to scan your first receipt and start tracking your spending."
          actionLabel="Scan a receipt"
          onAction={() => router.push('/(tabs)/scan')}
        />
      )}
    </ScrollView>
  );
}

