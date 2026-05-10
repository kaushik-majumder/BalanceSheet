import { computeStats } from '../lib/dashboardStats';
import { Receipt } from '../types';

const baseReceipt = (overrides: Partial<Receipt>): Receipt => ({
  id: 'r1',
  storeName: 'Test',
  date: new Date().toISOString(),
  totalAmount: 0,
  category: 'Other',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('computeStats', () => {
  it('returns zero totals for an empty receipts list', () => {
    const s = computeStats([]);
    expect(s.totalSpent).toBe(0);
    expect(s.receiptCount).toBe(0);
    expect(s.categories).toEqual([]);
    expect(s.topCategory).toBeNull();
    expect(s.avgPerReceipt).toBe(0);
  });

  it('falls back to receipt-level category for receipts without line items', () => {
    const receipts: Receipt[] = [
      baseReceipt({ id: 'a', totalAmount: 100, category: 'Groceries' }),
      baseReceipt({ id: 'b', totalAmount: 50, category: 'Gas' }),
    ];
    const s = computeStats(receipts);
    expect(s.totalSpent).toBe(150);
    const groceries = s.categories.find((c) => c.category === 'Groceries')!;
    const gas = s.categories.find((c) => c.category === 'Gas')!;
    expect(groceries.total).toBe(100);
    expect(gas.total).toBe(50);
    expect(groceries.count).toBe(1);
    expect(gas.count).toBe(1);
  });

  describe('item-level aggregation', () => {
    it('attributes a multi-category receipt across all its item categories', () => {
      const receipts: Receipt[] = [
        baseReceipt({
          id: 'costco',
          totalAmount: 200,
          category: 'Groceries',
          lineItems: [
            { id: '1', name: 'Milk', amount: 50, category: 'Groceries' },
            { id: '2', name: 'Shoes', amount: 100, category: 'Clothing' },
            { id: '3', name: 'Aspirin', amount: 50, category: 'Pharmacy' },
          ],
        }),
      ];
      const s = computeStats(receipts);
      expect(s.totalSpent).toBe(200);
      const cats = Object.fromEntries(s.categories.map((c) => [c.category, c.total]));
      expect(cats.Groceries).toBe(50);
      expect(cats.Clothing).toBe(100);
      expect(cats.Pharmacy).toBe(50);
      // Per-category totals must sum to the grand total.
      const sum = s.categories.reduce((a, c) => a + c.total, 0);
      expect(sum).toBeCloseTo(200, 2);
    });

    it('reports raw item amounts (no tax pro-rata) so the dashboard matches the drilldown', () => {
      // $90 of items + $10 tax = $100 receipt. Category totals are the
      // raw item prices ($30 / $60), NOT pro-rated to include the $10
      // tax. This keeps the dashboard breakdown numerically identical
      // to what the drilldown screen shows when the user taps in.
      const receipts: Receipt[] = [
        baseReceipt({
          id: 'walmart',
          totalAmount: 100,
          subtotalAmount: 90,
          taxAmount: 10,
          category: 'Groceries',
          lineItems: [
            { id: '1', name: 'Milk', amount: 30, category: 'Groceries' },
            { id: '2', name: 'Shoes', amount: 60, category: 'Clothing' },
          ],
        }),
      ];
      const s = computeStats(receipts);
      const cats = Object.fromEntries(s.categories.map((c) => [c.category, c.total]));
      expect(cats.Groceries).toBe(30);
      expect(cats.Clothing).toBe(60);
      // Categories sum to the SUBTOTAL, not the total — the $10 tax
      // intentionally lives only in the hero "Total Spent" number.
      const sum = s.categories.reduce((a, c) => a + c.total, 0);
      expect(sum).toBeCloseTo(90, 2);
    });

    it('counts a category once per receipt, not once per item', () => {
      const receipts: Receipt[] = [
        baseReceipt({
          id: 'r',
          totalAmount: 30,
          category: 'Groceries',
          lineItems: [
            { id: '1', name: 'Milk', amount: 10, category: 'Groceries' },
            { id: '2', name: 'Bread', amount: 10, category: 'Groceries' },
            { id: '3', name: 'Eggs', amount: 10, category: 'Groceries' },
          ],
        }),
      ];
      const s = computeStats(receipts);
      expect(s.categories[0].count).toBe(1);
    });

    it('aggregates custom (non-standard) item categories as their own bucket', () => {
      // User added a custom "Gym" tag to a Costco receipt and assigned
      // one item to it. The dashboard breakdown should surface "Gym"
      // as a distinct category, not collapse it into Other or Groceries.
      const receipts: Receipt[] = [
        baseReceipt({
          id: 'costco',
          totalAmount: 100,
          category: 'Groceries',
          lineItems: [
            { id: '1', name: 'Milk', amount: 50, category: 'Groceries' },
            { id: '2', name: 'Neoprene weight', amount: 50, category: 'Gym' },
          ],
        }),
      ];
      const s = computeStats(receipts);
      const cats = Object.fromEntries(s.categories.map((c) => [c.category, c.total]));
      expect(cats.Groceries).toBe(50);
      expect(cats.Gym).toBe(50);
      const sum = s.categories.reduce((a, c) => a + c.total, 0);
      expect(sum).toBeCloseTo(100, 2);
    });

    it('subtracts (does not add) negative discount lines from their category', () => {
      // Regression: dashboard previously used `Math.abs(item.amount)`,
      // so a -$15 TPD/markdown line on an "Other" item contributed +$15
      // to the Other bucket — double-counting against the EKO MIRROR.
      // The drilldown showed the correct $54.99 (signed sum) but the
      // dashboard showed an inflated number.
      const receipts: Receipt[] = [
        baseReceipt({
          id: 'costco',
          totalAmount: 54.99,
          category: 'Other',
          lineItems: [
            { id: '1', name: 'EKO MIRROR', amount: 69.99, category: 'Other' },
            { id: '2', name: 'TPD/1993379', amount: -15, category: 'Other' },
          ],
        }),
      ];
      const s = computeStats(receipts);
      const other = s.categories.find((c) => c.category === 'Other')!;
      // Net: 69.99 - 15 = 54.99 (no tax to scale → scale = 1).
      expect(other.total).toBeCloseTo(54.99, 2);
    });

    it('handles items with negative amounts (discounts) without distorting categories', () => {
      const receipts: Receipt[] = [
        baseReceipt({
          id: 'r',
          totalAmount: 80,
          category: 'Groceries',
          lineItems: [
            { id: '1', name: 'Milk', amount: 50, category: 'Groceries' },
            { id: '2', name: 'Discount', amount: -10, category: 'Groceries' },
            { id: '3', name: 'Shoes', amount: 40, category: 'Clothing' },
          ],
        }),
      ];
      const s = computeStats(receipts);
      // Categories must still sum to the receipt total.
      const sum = s.categories.reduce((a, c) => a + c.total, 0);
      expect(sum).toBeCloseTo(80, 2);
    });
  });

  it('topCategory is the one with the largest total', () => {
    const receipts: Receipt[] = [
      baseReceipt({
        id: '1',
        totalAmount: 100,
        category: 'Groceries',
        lineItems: [
          { id: 'a', name: 'item', amount: 30, category: 'Groceries' },
          { id: 'b', name: 'item', amount: 70, category: 'Clothing' },
        ],
      }),
      baseReceipt({ id: '2', totalAmount: 20, category: 'Gas' }),
    ];
    const s = computeStats(receipts);
    expect(s.topCategory).toBe('Clothing');
  });

  it('percentages sum to ~100', () => {
    const receipts: Receipt[] = [
      baseReceipt({ id: '1', totalAmount: 75, category: 'Groceries' }),
      baseReceipt({ id: '2', totalAmount: 25, category: 'Gas' }),
    ];
    const s = computeStats(receipts);
    const pctSum = s.categories.reduce((a, c) => a + c.percentage, 0);
    expect(pctSum).toBeCloseTo(100, 1);
  });
});
