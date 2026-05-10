import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, LineItem } from '../../types';
import { ALL_CATEGORIES } from '../../constants/categories';
import { theme } from '../../constants/theme';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

/**
 * Modal for editing a single detected line item — name, amount,
 * category, or delete it entirely. Used by both the scan review
 * screen and the receipt detail screen so users can fix small OCR /
 * AI parse mistakes inline.
 */
export function ItemEditModal({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: LineItem | null;
  onClose: () => void;
  onSave: (updated: LineItem) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [showCatPicker, setShowCatPicker] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setAmount(item.amount.toFixed(2));
      setCategory(item.category ?? 'Other');
      setShowCatPicker(false);
    }
  }, [item]);

  const submit = () => {
    if (!item) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter an item name.');
      return;
    }
    const amountVal = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountVal)) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    onSave({ ...item, name: name.trim(), amount: amountVal, category });
  };

  const confirmDelete = () => {
    if (!item) return;
    Alert.alert('Delete item?', `Remove "${item.name}" from this receipt?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  };

  return (
    <Modal
      visible={item != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit item</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Item name"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </Card>

          <Card style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Amount ($)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </Card>

          <Card style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Category</Text>
            <TouchableOpacity
              onPress={() => setShowCatPicker((v) => !v)}
              style={styles.categorySelector}
            >
              <Badge category={category} />
              <Ionicons
                name={showCatPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
            {showCatPicker && (
              <View style={styles.categoryGrid}>
                {ALL_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      setCategory(c);
                      setShowCatPicker(false);
                    }}
                    style={[
                      styles.categoryOption,
                      c === category && {
                        borderColor: theme.colors.category[c],
                        backgroundColor: `${theme.colors.category[c]}22`,
                      },
                    ]}
                  >
                    <Badge category={c} size="sm" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>

          <Button label="Save" onPress={submit} size="lg" style={{ marginTop: theme.spacing.md }} />
          <Button
            label="Delete item"
            onPress={confirmDelete}
            variant="danger"
            size="lg"
            style={{ marginTop: theme.spacing.xs }}
          />
        </ScrollView>
      </View>
    </Modal>
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
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
});
