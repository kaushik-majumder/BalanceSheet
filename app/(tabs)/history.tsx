import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllReceipts, deleteReceipt, searchReceipts } from '../../lib/database';
import { Receipt, Category } from '../../types';
import { useStyles, useTheme } from '../../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../../constants/categories';
import { ReceiptCard } from '../../components/receipt/ReceiptCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { receiptMatchesCategory } from '../../lib/receiptFilter';

const FILTER_ALL = 'All' as const;
type Filter = typeof FILTER_ALL | Category;

export default function HistoryScreen() {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: t.spacing.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    searchInput: {
      flex: 1,
      color: t.colors.textPrimary,
      fontSize: t.font.md,
    },
    filterList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.sm,
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.radius.full,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipIcon: {
      fontSize: 12,
    },
    chipLabel: {
      color: t.colors.textSecondary,
      fontSize: t.font.sm,
      fontWeight: '500',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
    summaryCount: {
      color: t.colors.textMuted,
      fontSize: t.font.sm,
    },
    summaryTotal: {
      color: t.colors.primary,
      fontSize: t.font.sm,
      fontWeight: '700',
    },
    listContent: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: 32,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
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
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>(FILTER_ALL);
  const params = useLocalSearchParams<{ category?: string }>();

  // When the dashboard navigates here with `?category=X`, pre-select X
  // as the filter. Re-fires whenever a fresh navigation arrives.
  useEffect(() => {
    if (
      params.category &&
      (ALL_CATEGORIES as readonly string[]).includes(params.category)
    ) {
      setActiveFilter(params.category as Category);
    }
  }, [params.category]);

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getAllReceipts();
    setReceipts(data);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (query.trim()) {
        const results = await searchReceipts(query.trim());
        setReceipts(results);
      } else {
        await load();
      }
    } finally {
      setRefreshing(false);
    }
  }, [query, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length > 0) {
      const results = await searchReceipts(text.trim());
      setReceipts(results);
    } else {
      await load();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Receipt', 'Are you sure you want to delete this receipt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(id);
          await load();
        },
      },
    ]);
  };

  // A receipt matches the active filter when EITHER:
  //   - its primary `category` equals the filter, OR
  //   - any of its categoryTags equals the filter, OR
  //   - any of its line items has that category
  // This way a Walmart receipt with a Healthcare item shows up under the
  // Healthcare filter even though the primary category is Groceries.
  const filtered =
    activeFilter === FILTER_ALL
      ? receipts
      : receipts.filter((r) => receiptMatchesCategory(r, activeFilter));

  const totalFiltered = filtered.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <View style={styles.screen}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search receipts..."
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips — wrap onto multiple rows so all
          categories are visible without horizontal scrolling. */}
      <View style={styles.filterList}>
        {([FILTER_ALL, ...ALL_CATEGORIES] as Filter[]).map((item) => {
          const active = activeFilter === item;
          const color =
            item === FILTER_ALL
              ? theme.colors.primary
              : theme.colors.category[item as Category];
          return (
            <TouchableOpacity
              key={item}
              onPress={() => setActiveFilter(item)}
              style={[
                styles.chip,
                active && { backgroundColor: `${color}22`, borderColor: color },
              ]}
            >
              {item !== FILTER_ALL && (
                <Text style={styles.chipIcon}>
                  {CATEGORY_ICONS[item as Category]}
                </Text>
              )}
              <Text
                style={[styles.chipLabel, active && { color, fontWeight: '700' }]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary row */}
      {filtered.length > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryCount}>{filtered.length} receipt{filtered.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.summaryTotal}>${totalFiltered.toFixed(2)} total</Text>
        </View>
      )}

      {/* Receipt list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReceiptCard receipt={item} onDelete={handleDelete} />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          query ? (
            <EmptyState
              icon="search-outline"
              title="No receipts found"
              description={`No receipts match "${query}". Try a different search term or clear the search to see everything.`}
            />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No receipts yet"
              description="Scan your first receipt with the camera tab and it'll show up here, grouped by category and date."
            />
          )
        }
      />
    </View>
  );
}

