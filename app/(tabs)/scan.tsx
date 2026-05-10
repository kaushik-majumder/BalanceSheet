import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TextRecognition from 'react-native-text-recognition';
import { v4 as uuidv4 } from 'uuid';
import { saveReceipt } from '../../lib/database';
import { parseReceiptText } from '../../lib/parser';
import { parseReceiptWithGemini } from '../../lib/geminiParseReceipt';
import { ParsedReceipt, Category, LineItem } from '../../types';
import { theme } from '../../constants/theme';
import { ALL_CATEGORIES } from '../../constants/categories';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

type ScanState = 'idle' | 'processing' | 'review';

export default function ScanScreen() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields in review state
  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [notes, setNotes] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [aiPending, setAiPending] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  const runOCR = async (uri: string) => {
    setScanState('processing');
    try {
      const lines: string[] = await TextRecognition.recognize(uri);
      const rawText = lines.join('\n');
      const result = parseReceiptText(rawText);

      setParsed(result);
      setStoreName(result.storeName);
      setDate(format(new Date(result.date), 'yyyy-MM-dd'));
      setAmount(result.totalAmount > 0 ? result.totalAmount.toFixed(2) : '');
      setSubtotal(result.subtotalAmount != null ? result.subtotalAmount.toFixed(2) : '');
      setTax(result.taxAmount != null ? result.taxAmount.toFixed(2) : '');
      setCategory(result.category);
      setItems(result.lineItems);
      setAiApplied(false);
      setScanState('review');

      // Fire AI parse in parallel. The user sees the regex result
      // immediately; when Gemini returns we replace the state in-place
      // if the AI parse looks better (more items, or has totals the
      // regex missed).
      const geminiKey = (Constants.expoConfig?.extra as { geminiApiKey?: string } | undefined)
        ?.geminiApiKey;
      if (geminiKey) {
        setAiPending(true);
        parseReceiptWithGemini(rawText, geminiKey)
          .then((aiResult) => {
            if (!aiResult.ok) return;
            const ai = aiResult.receipt;
            // Trust AI when it found at least as many items, OR found
            // totals (subtotal/tax) that the regex missed.
            const aiBetter =
              ai.lineItems.length >= result.lineItems.length ||
              (ai.subtotalAmount != null && result.subtotalAmount == null) ||
              (ai.taxAmount != null && result.taxAmount == null);
            if (!aiBetter) return;
            setStoreName(ai.storeName);
            if (ai.date) setDate(format(new Date(ai.date), 'yyyy-MM-dd'));
            if (ai.totalAmount > 0) setAmount(ai.totalAmount.toFixed(2));
            if (ai.subtotalAmount != null) setSubtotal(ai.subtotalAmount.toFixed(2));
            if (ai.taxAmount != null) setTax(ai.taxAmount.toFixed(2));
            setItems(ai.lineItems);
            setAiApplied(true);
          })
          .finally(() => setAiPending(false));
      }
    } catch (err) {
      Alert.alert(
        'OCR Failed',
        'Could not read the receipt. Please enter the details manually.',
        [{ text: 'OK' }],
      );
      setParsed({ storeName: '', date: new Date().toISOString(), totalAmount: 0, category: 'Other', lineItems: [], rawText: '' });
      setStoreName('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setAmount('');
      setSubtotal('');
      setTax('');
      setCategory('Other');
      setItems([]);
      setScanState('review');
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to scan receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await runOCR(result.assets[0].uri);
    }
  };

  const startManualEntry = () => {
    setImageUri(null);
    setParsed({
      storeName: '',
      date: new Date().toISOString(),
      totalAmount: 0,
      category: 'Other',
      lineItems: [],
      rawText: '',
    });
    setStoreName('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setAmount('');
    setSubtotal('');
    setTax('');
    setCategory('Other');
    setNotes('');
    setItems([]);
    setScanState('review');
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to import receipts.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await runOCR(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Missing field', 'Please enter a store name.');
      return;
    }
    const amountVal = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountVal) || amountVal < 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      let parsedDate: Date;
      try {
        parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) parsedDate = new Date();
      } catch {
        parsedDate = new Date();
      }

      const subtotalVal = subtotal.trim() ? parseFloat(subtotal.replace(',', '.')) : undefined;
      const taxVal = tax.trim() ? parseFloat(tax.replace(',', '.')) : undefined;

      await saveReceipt({
        id: uuidv4(),
        storeName: storeName.trim(),
        date: parsedDate.toISOString(),
        totalAmount: amountVal,
        subtotalAmount: subtotalVal != null && !isNaN(subtotalVal) ? subtotalVal : undefined,
        taxAmount: taxVal != null && !isNaN(taxVal) ? taxVal : undefined,
        category,
        rawText: parsed?.rawText,
        imageUri: imageUri ?? undefined,
        notes: notes.trim() || undefined,
        lineItems: items,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('Saved!', 'Receipt has been saved successfully.', [
        {
          text: 'View Dashboard',
          onPress: () => {
            resetState();
            router.push('/(tabs)');
          },
        },
        { text: 'Scan Another', onPress: resetState },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', `Failed to save receipt: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setScanState('idle');
    setImageUri(null);
    setParsed(null);
    setStoreName('');
    setDate('');
    setAmount('');
    setSubtotal('');
    setTax('');
    setCategory('Other');
    setNotes('');
    setItems([]);
    setShowAllItems(false);
    setEditingItem(null);
    setAiPending(false);
    setAiApplied(false);
  };

  const saveEditedItem = (updated: LineItem) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setEditingItem(null);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setEditingItem(null);
  };

  // ─── Idle state ────────────────────────────────────────────────────────────
  if (scanState === 'idle') {
    return (
      <View style={styles.screen}>
        <LinearGradient
          colors={[theme.colors.background, theme.colors.surface]}
          style={styles.idleContainer}
        >
          <View style={styles.iconRing}>
            <Ionicons name="scan" size={56} color={theme.colors.primary} />
          </View>
          <Text style={styles.idleTitle}>Scan a Receipt</Text>
          <Text style={styles.idleSubtitle}>
            Use your camera or import from gallery.{'\n'}ML Kit reads the text on-device — no internet needed.
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={pickFromCamera} activeOpacity={0.8}>
              <LinearGradient
                colors={[theme.colors.primaryDark, theme.colors.primary]}
                style={styles.actionGradient}
              >
                <Ionicons name="camera" size={32} color="#fff" />
                <Text style={styles.actionLabel}>Camera</Text>
                <Text style={styles.actionSub}>Take a photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={pickFromGallery} activeOpacity={0.8}>
              <View style={[styles.actionGradient, { backgroundColor: theme.colors.surfaceHigh }]}>
                <Ionicons name="images-outline" size={32} color={theme.colors.primary} />
                <Text style={styles.actionLabel}>Gallery</Text>
                <Text style={styles.actionSub}>Import an image</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.manualEntry}
            onPress={startManualEntry}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.manualEntryText}>Enter manually (no receipt)</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Works with grocery, restaurant, electronics & more receipts
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // ─── Processing state ───────────────────────────────────────────────────────
  if (scanState === 'processing') {
    return (
      <View style={[styles.screen, styles.centered]}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.processingImage} />
        )}
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.processingText}>Reading receipt...</Text>
          <Text style={styles.processingSubText}>ML Kit is extracting text on-device</Text>
        </View>
      </View>
    );
  }

  // ─── Review state ───────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.reviewContent}
      keyboardShouldPersistTaps="handled"
    >
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.receiptThumb} resizeMode="cover" />
      )}

      <View style={styles.reviewHeader}>
        <Text style={styles.reviewTitle}>Review & Confirm</Text>
        <Text style={styles.reviewSub}>Edit any fields before saving</Text>
        {aiPending && (
          <View style={styles.aiChipPending}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.aiChipText}>Improving with AI…</Text>
          </View>
        )}
        {!aiPending && aiApplied && (
          <View style={styles.aiChipApplied}>
            <Ionicons name="sparkles" size={14} color={theme.colors.primary} />
            <Text style={styles.aiChipText}>AI improved this receipt</Text>
          </View>
        )}
      </View>

      {/* Store name */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Store / Merchant</Text>
        <TextInput
          style={styles.input}
          value={storeName}
          onChangeText={setStoreName}
          placeholder="e.g. Whole Foods Market"
          placeholderTextColor={theme.colors.textMuted}
          autoCorrect={false}
        />
      </Card>

      {/* Subtotal */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Subtotal ($) — optional</Text>
        <TextInput
          style={styles.input}
          value={subtotal}
          onChangeText={setSubtotal}
          placeholder="Subtotal before tax"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
        />
      </Card>

      {/* Tax */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Tax ($) — optional</Text>
        <TextInput
          style={styles.input}
          value={tax}
          onChangeText={setTax}
          placeholder="Tax amount"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
        />
      </Card>

      {/* Total */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Total Amount ($)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
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

      {/* Category */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Category</Text>
        <TouchableOpacity
          style={styles.categorySelector}
          onPress={() => setShowCategoryPicker((v) => !v)}
        >
          <Badge category={category} />
          <Ionicons
            name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {showCategoryPicker && (
          <View style={styles.categoryGrid}>
            {ALL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryPicker(false);
                }}
                style={[
                  styles.categoryOption,
                  cat === category && {
                    borderColor: theme.colors.category[cat],
                    backgroundColor: `${theme.colors.category[cat]}22`,
                  },
                ]}
              >
                <Badge category={cat} size="sm" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>

      {/* Notes */}
      <Card style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any notes..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </Card>

      {/* Line items — tap a row to edit / delete. */}
      {items.length > 0 && (
        <Card style={styles.fieldCard}>
          <View style={styles.itemsHeader}>
            <Text style={styles.fieldLabel}>
              Detected Line Items ({items.length})
            </Text>
            <Text style={styles.itemsHint}>Tap to edit</Text>
          </View>
          {(showAllItems ? items : items.slice(0, 12)).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setEditingItem(item)}
              style={({ pressed }) => [
                styles.lineItemRow,
                pressed && styles.lineItemRowPressed,
              ]}
            >
              <Text style={styles.lineItemName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.category && <Badge category={item.category} size="sm" />}
              <Text style={styles.lineItemAmount}>
                ${item.amount.toFixed(2)}
              </Text>
            </Pressable>
          ))}
          {items.length > 12 && (
            <TouchableOpacity
              onPress={() => setShowAllItems((v) => !v)}
              style={styles.moreItemsBtn}
            >
              <Text style={styles.moreItemsText}>
                {showAllItems
                  ? 'Show fewer'
                  : `Show ${items.length - 12} more items`}
              </Text>
              <Ionicons
                name={showAllItems ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </Card>
      )}

      <ItemEditModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={saveEditedItem}
        onDelete={deleteItem}
      />

      <View style={styles.buttonRow}>
        <Button
          label="Discard"
          onPress={resetState}
          variant="secondary"
          style={styles.btnHalf}
        />
        <Button
          label="Save Receipt"
          onPress={handleSave}
          loading={saving}
          style={styles.btnHalf}
        />
      </View>
    </ScrollView>
  );
}

/**
 * Modal for editing a single detected line item — name, amount, category,
 * or delete it entirely. Used by the scan review screen so the user can
 * fix small OCR mistakes before saving.
 */
function ItemEditModal({
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

  React.useEffect(() => {
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
    if (isNaN(amountVal) || amountVal < 0) {
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
      <View style={styles.itemModalRoot}>
        <View style={styles.itemModalHeader}>
          <Text style={styles.itemModalTitle}>Edit item</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.itemModalContent}>
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
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Idle
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  iconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: theme.colors.primaryFaint,
    borderWidth: 2,
    borderColor: `${theme.colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  idleTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xxl,
    fontWeight: '800',
  },
  idleSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: '100%',
  },
  actionCard: {
    flex: 1,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.xl,
  },
  actionLabel: {
    color: '#fff',
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  actionSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: theme.font.xs,
  },
  manualEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceHigh,
    marginTop: theme.spacing.xs,
  },
  manualEntryText: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  // Processing
  processingImage: {
    width: '100%',
    height: 260,
    opacity: 0.35,
  },
  processingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xl,
    fontWeight: '700',
  },
  processingSubText: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
  },
  // Review
  reviewContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingBottom: 40,
  },
  receiptThumb: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
  },
  reviewHeader: {
    marginBottom: theme.spacing.xs,
  },
  reviewTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xl,
    fontWeight: '800',
  },
  reviewSub: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
  },
  aiChipPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryFaint,
    marginTop: 8,
  },
  aiChipApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryFaint,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginTop: 8,
  },
  aiChipText: {
    color: theme.colors.primary,
    fontSize: theme.font.xs,
    fontWeight: '700',
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
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemsHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lineItemRowPressed: {
    backgroundColor: theme.colors.surfaceHigh,
  },
  itemModalRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  itemModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  itemModalContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  lineItemName: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    flex: 1,
    marginRight: 4,
  },
  lineItemAmount: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'right',
  },
  moreItemsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 8,
  },
  moreItemsText: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  btnHalf: {
    flex: 1,
  },
});
