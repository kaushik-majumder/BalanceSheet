import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllReceipts, deleteReceipt, searchReceipts } from '../../lib/database';
import { Receipt, Category } from '../../types';
import { theme } from '../../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../../constants/categories';
import { ReceiptCard } from '../../components/receipt/ReceiptCard';

const FILTER_ALL = 'All' as const;
type Filter = typeof FILTER_ALL | Category;

export default function HistoryScreen() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>(FILTER_ALL);

  const load = useCallback(async () => {
    const data = await getAllReceipts();
    setReceipts(data);
  }, []);

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

  const filtered =
    activeFilter === FILTER_ALL
      ? receipts
      : receipts.filter((r) => r.category === activeFilter);

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

      {/* Category filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[FILTER_ALL, ...ALL_CATEGORIES]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const active = activeFilter === item;
          const color =
            item === FILTER_ALL ? theme.colors.primary : theme.colors.category[item as Category];
          return (
            <TouchableOpacity
              onPress={() => setActiveFilter(item as Filter)}
              style={[
                styles.chip,
                active && { backgroundColor: `${color}22`, borderColor: color },
              ]}
            >
              {item !== FILTER_ALL && (
                <Text style={styles.chipIcon}>{CATEGORY_ICONS[item as Category]}</Text>
              )}
              <Text style={[styles.chipLabel, active && { color }]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={52} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No receipts found</Text>
            <Text style={styles.emptyText}>
              {query ? 'Try a different search term' : 'Scan your first receipt using the camera tab'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: theme.spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
  },
  filterList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipIcon: {
    fontSize: 12,
  },
  chipLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  summaryCount: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
  },
  summaryTotal: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 32,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
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
