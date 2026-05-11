import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Receipt } from '../../types';
import { useStyles, useTheme } from '../../constants/theme';
import { Badge } from '../ui/Badge';
import { TagChip } from '../ui/TagChip';

interface Props {
  receipt: Receipt;
  onDelete?: (id: string) => void;
}

export function ReceiptCard({ receipt, onDelete }: Props) {
  const theme = useTheme();
  const styles = useStyles((t) => ({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      justifyContent: 'space-between',
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      flex: 1,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: t.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    },
    thumb: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 44,
      height: 44,
      borderRadius: t.radius.md,
    },
    iconText: {
      fontSize: t.font.lg,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    storeName: {
      color: t.colors.textPrimary,
      fontSize: t.font.md,
      fontWeight: '600',
    },
    date: {
      color: t.colors.textSecondary,
      fontSize: t.font.xs,
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
      color: t.colors.textMuted,
      fontSize: t.font.xs,
      alignSelf: 'center',
    },
    right: {
      alignItems: 'flex-end',
      gap: 8,
      flexShrink: 0,
      paddingLeft: t.spacing.sm,
    },
    amount: {
      color: t.colors.primary,
      fontSize: t.font.lg,
      fontWeight: '700',
    },
  }));
  const router = useRouter();

  // Verify the receipt's photo actually exists on disk so we don't
  // render a broken Image overlay on top of the letter avatar.
  // For legacy receipts whose imageUri is a stale cache path, the
  // letter avatar stays visible (Image element never mounts).
  const [thumbReady, setThumbReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (!receipt.imageUri) {
      setThumbReady(false);
      return;
    }
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(receipt.imageUri!);
        if (mounted) setThumbReady(!!info.exists);
      } catch {
        if (mounted) setThumbReady(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [receipt.imageUri]);

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
          {thumbReady && receipt.imageUri && (
            <Image
              source={{ uri: receipt.imageUri }}
              style={styles.thumb}
              resizeMode="cover"
              onError={() => setThumbReady(false)}
            />
          )}
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
