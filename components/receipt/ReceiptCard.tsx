import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Receipt } from '../../types';
import { theme } from '../../constants/theme';
import { Badge } from '../ui/Badge';
import { TagChip } from '../ui/TagChip';

interface Props {
  receipt: Receipt;
  onDelete?: (id: string) => void;
}

export function ReceiptCard({ receipt, onDelete }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/edit/${receipt.id}`)}
      style={styles.card}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: `${theme.colors.category[receipt.category]}22` },
          ]}
        >
          <Text style={styles.iconText}>
            {receipt.storeName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.storeName} numberOfLines={1}>
            {receipt.storeName}
          </Text>
          <Text style={styles.date}>
            {format(new Date(receipt.date), 'MMM d, yyyy')}
          </Text>
          {(() => {
            const tags = receipt.categoryTags?.length
              ? receipt.categoryTags
              : [receipt.category];
            // Show up to 3 tag chips on the card; pad with "+N" if more.
            const visible = tags.slice(0, 3);
            const extra = tags.length - visible.length;
            return (
              <View style={styles.tagsRow}>
                {visible.map((t) => (
                  <TagChip key={t} tag={t} size="sm" />
                ))}
                {extra > 0 ? (
                  <Text style={styles.extraTags}>+{extra}</Text>
                ) : null}
              </View>
            );
          })()}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>${receipt.totalAmount.toFixed(2)}</Text>
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(receipt.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: theme.font.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  storeName: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '600',
  },
  date: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.xs,
  },
  badge: {
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  extraTags: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    alignSelf: 'center',
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
    paddingLeft: theme.spacing.sm,
  },
  amount: {
    color: theme.colors.primary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
});
