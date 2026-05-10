import { buildCategoryDrilldown } from '../lib/categoryDrilldown';
import { Receipt } from '../types';

const baseReceipt = (overrides: Partial<Receipt>): Receipt => ({
  id: 'r1',
  storeName: 'Test',
  date: '2026-05-01T00:00:00.000Z',
  totalAmount: 0,
  category: 'Other',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('buildCategoryDrilldown', () => {
  it('returns an empty result when nothing matches', () => {
    const r = buildCategoryDrilldown([], 'Groceries');
    expect(r.totalSpent).toBe(0);
    expect(r.groups).toEqual([]);
    expect(r.category).toBe('Groceries');
  });

  it('extracts only the items in the requested category from a multi-category receipt', () => {
    const walmart = baseReceipt({
      id: 'w',
      storeName: 'Walmart',
      totalAmount: 100,
      category: 'Groceries',
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
        { id: '2', name: 'Tylenol', amount: 12, category: 'Pharmacy' },
        { id: '3', name: 'Aspirin', amount: 8, category: 'Pharmacy' },
      ],
    });
    const r = buildCategoryDrilldown([walmart], 'Pharmacy');
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].items).toHaveLength(2);
    expect(r.groups[0].items.map((i) => i.name).sort()).toEqual([
      'Aspirin',
      'Tylenol',
    ]);
    expect(r.groups[0].subtotal).toBe(20); // 12 + 8
    expect(r.totalSpent).toBe(20);
  });

  it('skips receipts that have line items but none match the category', () => {
    const r = baseReceipt({
      id: 'r',
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
      ],
    });
    expect(buildCategoryDrilldown([r], 'Travel').groups).toEqual([]);
  });

  it('falls back to whole-receipt for receipts with no line items but matching primary category', () => {
    const r = baseReceipt({
      id: 'oldish',
      storeName: 'Costco',
      category: 'Gas',
      totalAmount: 60,
    });
    const result = buildCategoryDrilldown([r], 'Gas');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].isWholeReceipt).toBe(true);
    expect(result.groups[0].subtotal).toBe(60);
    expect(result.totalSpent).toBe(60);
  });

  it('does NOT fall back to whole-receipt when line items exist but none match', () => {
    // Receipt has line items but they're all Groceries. Even though the
    // primary category is Pharmacy (suspicious data), we should NOT
    // attribute the whole receipt to Pharmacy because we DO have item-
    // level data showing it isn't pharmacy.
    const r = baseReceipt({
      id: 'r',
      category: 'Pharmacy',
      totalAmount: 50,
      lineItems: [{ id: '1', name: 'Milk', amount: 50, category: 'Groceries' }],
    });
    expect(buildCategoryDrilldown([r], 'Pharmacy').groups).toEqual([]);
  });

  it('aggregates totals across multiple matching receipts', () => {
    const r1 = baseReceipt({
      id: 'a',
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
        { id: '2', name: 'Bread', amount: 4, category: 'Groceries' },
      ],
    });
    const r2 = baseReceipt({
      id: 'b',
      lineItems: [
        { id: '3', name: 'Apples', amount: 3, category: 'Groceries' },
      ],
    });
    const result = buildCategoryDrilldown([r1, r2], 'Groceries');
    expect(result.groups).toHaveLength(2);
    expect(result.totalSpent).toBe(12); // 5 + 4 + 3
  });

  it('orders groups most-recent first', () => {
    const older = baseReceipt({
      id: 'older',
      date: '2026-04-01T00:00:00.000Z',
      lineItems: [
        { id: '1', name: 'X', amount: 1, category: 'Groceries' },
      ],
    });
    const newer = baseReceipt({
      id: 'newer',
      date: '2026-05-15T00:00:00.000Z',
      lineItems: [
        { id: '2', name: 'Y', amount: 2, category: 'Groceries' },
      ],
    });
    const result = buildCategoryDrilldown([older, newer], 'Groceries');
    expect(result.groups[0].receiptId).toBe('newer');
    expect(result.groups[1].receiptId).toBe('older');
  });

  it('preserves item amounts unscaled (no tax redistribution at the drilldown level)', () => {
    // Even though dashboardStats scales item amounts to include tax, the
    // drilldown screen shows actual item prices the user can recognize
    // from their physical receipt.
    const r = baseReceipt({
      id: 'r',
      totalAmount: 100, // includes tax
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
      ],
    });
    const result = buildCategoryDrilldown([r], 'Groceries');
    expect(result.groups[0].items[0].amount).toBe(5);
    expect(result.groups[0].subtotal).toBe(5);
  });

  it('handles items with negative (discount) amounts', () => {
    const r = baseReceipt({
      id: 'r',
      lineItems: [
        { id: '1', name: 'EKO MIRROR', amount: 70, category: 'Other' },
        { id: '2', name: 'TPD/ markdown', amount: -15, category: 'Other' },
      ],
    });
    const result = buildCategoryDrilldown([r], 'Other');
    expect(result.groups[0].subtotal).toBe(55);
  });
});
