import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { getReceiptById, updateReceipt, deleteReceipt } from '../../lib/database';
import { refineUncategorizedItems } from '../../lib/itemClassifier';
import { Receipt, Category, LineItem } from '../../types';
import { theme } from '../../constants/theme';
import { ALL_CATEGORIES, CATEGORY_ICONS } from '../../constants/categories';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryTagsPicker } from '../../components/ui/CategoryTagsPicker';

type CategoryGroup = {
  category: Category;
  items: LineItem[];
  subtotal: number;
};

function groupItemsByCategory(
  items: LineItem[],
  receiptCategory: Category,
): CategoryGroup[] {
  const map = new Map<Category, LineItem[]>();
  for (const item of items) {
    // Older items written before per-item categorization fall back to the
    // receipt-level category so they still group sensibly.
    const c = item.category ?? receiptCategory;
    const list = map.get(c);
    if (list) list.push(item);
    else map.set(c, [item]);
  }
  return Array.from(map.entries())
    .map(([category, list]) => ({
      category,
      items: list,
      subtotal: list.reduce((s, i) => s + i.amount, 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

export default function EditReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [categoryTags, setCategoryTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      const r = await getReceiptById(id);
      if (!mounted || !r) {
        if (mounted) setLoading(false);
        return;
      }
      setReceipt(r);
      setStoreName(r.storeName);
      setDate(format(new Date(r.date), 'yyyy-MM-dd'));
      setAmount(r.totalAmount.toFixed(2));
      setCategory(r.category);
      setCategoryTags(r.categoryTags ?? [r.category]);
      setNotes(r.notes ?? '');
      setLoading(false);

      // Background refinement — run the async classifier on items still
      // marked 'Other'. Updates land in the DB; refresh local state on
      // success so the UI re-renders the new category badges.
      if (r.lineItems?.length) {
        try {
          const refined = await refineUncategorizedItems(r.lineItems);
          if (mounted) setReceipt({ ...r, lineItems: refined });
        } catch {
          // best-effort; ignore
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSave = async () => {
    if (!receipt) return;
    if (!storeName.trim()) {
      Alert.alert('Missing field', 'Please enter a store name.');
      return;
    }
    const amountVal = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountVal) || amountVal < 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    let parsedDate: Date;
    try {
      parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) parsedDate = new Date(receipt.date);
    } catch {
      parsedDate = new Date(receipt.date);
    }

    setSaving(true);
    try {
      // Derive primary category from the tag list — first standard
      // category found, fall back to existing primary if all tags
      // are custom strings.
      const primary: Category =
        (categoryTags.find((t) =>
          (ALL_CATEGORIES as readonly string[]).includes(t),
        ) as Category | undefined) ?? category;
      await updateReceipt({
        ...receipt,
        storeName: storeName.trim(),
        date: parsedDate.toISOString(),
        totalAmount: amountVal,
        category: primary,
        categoryTags: categoryTags.length ? categoryTags : [primary],
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Receipt', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!receipt) return;
          await deleteReceipt(receipt.id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.notFoundText}>Receipt not found</Text>
        <Button label="Go back" onPress={() => router.back()} variant="ghost" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Receipt image */}
      {receipt.imageUri && (
        <Image
          source={{ uri: receipt.imageUri }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Meta info */}
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Added {format(new Date(receipt.createdAt), 'MMM d, yyyy · h:mm a')}
        </Text>
        {receipt.updatedAt !== receipt.createdAt && (
          <Text style={styles.metaText}>
            Edited {format(new Date(receipt.updatedAt), 'MMM d, yyyy')}
          </Text>
        )}
      </View>

      {/* Store name */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Store / Merchant</Text>
        <TextInput
          style={styles.input}
          value={storeName}
          onChangeText={setStoreName}
          placeholder="Store name"
          placeholderTextColor={theme.colors.textMuted}
          autoCorrect={false}
        />
      </Card>

      {/* Amount */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Total Amount ($)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted}
        />
      </Card>

      {/* Date */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="2026-05-08"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        />
      </Card>

      {/* Categories — multi-select tags */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Categories</Text>
        <CategoryTagsPicker tags={categoryTags} onChange={setCategoryTags} />
      </Card>

      {/* Notes */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </Card>

      {/* Line items grouped by category, with tax + total */}
      {receipt.lineItems && receipt.lineItems.length > 0 && (
        <Card style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>
            Items ({receipt.lineItems.length})
          </Text>
          {groupItemsByCategory(receipt.lineItems, receipt.category).map((group) => (
            <View key={group.category} style={styles.categoryGroup}>
              <View style={styles.categoryGroupHeader}>
                <Badge category={group.category} size="sm" />
                <Text style={styles.categoryGroupTotal}>
                  ${group.subtotal.toFixed(2)}
                </Text>
              </View>
              {group.items.map((item) => (
                <View key={item.id} style={styles.lineItemRow}>
                  <Text style={styles.lineItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.lineItemAmount}>${item.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.totalsBlock}>
            {receipt.subtotalAmount != null && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>
                  ${receipt.subtotalAmount.toFixed(2)}
                </Text>
              </View>
            )}
            {receipt.taxAmount != null && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>
                  ${receipt.taxAmount.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={styles.totalsLabelGrand}>Total</Text>
              <Text style={styles.totalsValueGrand}>
                ${receipt.totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Raw OCR text — useful for debugging "why didn't the parser
          extract anything?". Opens a scrollable, share-friendly modal. */}
      {receipt.rawText && (
        <TouchableOpacity
          onPress={() => setShowRawText(true)}
          style={styles.rawTextLink}
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.rawTextLinkText}>
            Show raw OCR text ({receipt.rawText.length} chars)
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showRawText}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRawText(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Raw OCR text</Text>
            <Pressable onPress={() => setShowRawText(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text selectable style={styles.modalText}>
              {receipt.rawText ?? '(empty)'}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Actions */}
      <Button
        label="Save Changes"
        onPress={handleSave}
        loading={saving}
        size="lg"
        style={styles.saveBtn}
      />

      <Button
        label="Delete Receipt"
        onPress={handleDelete}
        variant="danger"
        size="lg"
        style={styles.deleteBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingBottom: 40,
  },
  notFoundText: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.lg,
    marginBottom: theme.spacing.md,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: theme.spacing.xs,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
  },
  fieldCard: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 10,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: theme.spacing.xs,
  },
  categoryOption: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 2,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lineItemName: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    flex: 1,
    marginRight: 8,
  },
  lineItemAmount: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
  categoryGroup: {
    marginTop: theme.spacing.sm,
  },
  categoryGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  categoryGroupTotal: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '700',
  },
  totalsBlock: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalsRowGrand: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalsLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
  },
  totalsValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
  totalsLabelGrand: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.md,
    fontWeight: '700',
  },
  totalsValueGrand: {
    color: theme.colors.primary,
    fontSize: theme.font.lg,
    fontWeight: '800',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: theme.spacing.lg,
  },
  modalText: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  rawTextLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
  },
  rawTextLinkText: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.xs,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: theme.spacing.sm,
  },
  deleteBtn: {
    marginTop: theme.spacing.xs,
  },
});
