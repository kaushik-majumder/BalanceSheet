import {
  summarizeMonth,
  monthOverMonthDelta,
  monthlyTrend,
  topStores,
} from '../lib/reports';
import { Receipt } from '../types';

const baseReceipt = (overrides: Partial<Receipt>): Receipt => ({
  id: Math.random().toString(36).slice(2),
  storeName: 'Test',
  date: '2026-05-15T00:00:00.000Z',
  totalAmount: 0,
  category: 'Other',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Build a local-midnight ISO so the timezone-aware getReceiptYearMonth
// inside reports.ts puts the receipt in the expected wall-clock month
// regardless of where the test machine sits.
const localIso = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d).toISOString();

describe('summarizeMonth', () => {
  it('returns zeros for an empty month', () => {
    const s = summarizeMonth([], 2026, 5);
    expect(s.total).toBe(0);
    expect(s.receiptCount).toBe(0);
    expect(s.categories).toEqual([]);
    expect(s.topCategory).toBeNull();
    expect(s.biggestReceipt).toBeNull();
    expect(s.biggestItem).toBeNull();
    expect(s.avgPerReceipt).toBe(0);
  });

  it('computes total, count, and average', () => {
    const s = summarizeMonth(
      [
        baseReceipt({ id: 'a', totalAmount: 50 }),
        baseReceipt({ id: 'b', totalAmount: 150 }),
      ],
      2026,
      5,
    );
    expect(s.total).toBe(200);
    expect(s.receiptCount).toBe(2);
    expect(s.avgPerReceipt).toBe(100);
  });

  it('picks the biggest receipt by total', () => {
    const s = summarizeMonth(
      [
        baseReceipt({ id: 'a', totalAmount: 50, storeName: 'Small' }),
        baseReceipt({ id: 'b', totalAmount: 257.05, storeName: 'Skechers' }),
        baseReceipt({ id: 'c', totalAmount: 100, storeName: 'Mid' }),
      ],
      2026,
      5,
    );
    expect(s.biggestReceipt).toEqual({
      receiptId: 'b',
      storeName: 'Skechers',
      date: expect.any(String),
      total: 257.05,
    });
  });

  it('picks the biggest non-discount line item across all receipts', () => {
    const s = summarizeMonth(
      [
        baseReceipt({
          id: 'r1',
          storeName: 'Costco',
          totalAmount: 100,
          lineItems: [
            { id: '1', name: 'Milk', amount: 5 },
            { id: '2', name: 'EKO MIRROR', amount: 69.99 },
          ],
        }),
        baseReceipt({
          id: 'r2',
          storeName: 'Walmart',
          totalAmount: 50,
          lineItems: [
            { id: '3', name: 'Discount', amount: -15 },
            { id: '4', name: 'Bread', amount: 8 },
          ],
        }),
      ],
      2026,
      5,
    );
    expect(s.biggestItem).toEqual({
      receiptId: 'r1',
      storeName: 'Costco',
      itemName: 'EKO MIRROR',
      amount: 69.99,
    });
  });

  it('sorts categories descending and picks topCategory', () => {
    const s = summarizeMonth(
      [
        baseReceipt({
          totalAmount: 100,
          lineItems: [
            { id: '1', name: 'Milk', amount: 30, category: 'Groceries' },
            { id: '2', name: 'Shoes', amount: 70, category: 'Clothing' },
          ],
        }),
      ],
      2026,
      5,
    );
    expect(s.categories.map((c) => c.category)).toEqual(['Clothing', 'Groceries']);
    expect(s.topCategory?.category).toBe('Clothing');
  });

  it('handles custom categoryTag-style categories alongside standard ones', () => {
    const s = summarizeMonth(
      [
        baseReceipt({
          totalAmount: 200,
          lineItems: [
            { id: '1', name: 'Shoes', amount: 150, category: 'Footwear' },
            { id: '2', name: 'Polish', amount: 50, category: 'Other' },
          ],
        }),
      ],
      2026,
      5,
    );
    expect(s.topCategory?.category).toBe('Footwear');
    expect(s.categories.find((c) => c.category === 'Footwear')?.total).toBe(150);
  });
});

describe('monthOverMonthDelta', () => {
  it('returns a positive delta when this month spent more than last', () => {
    const receipts = [
      baseReceipt({ id: '1', date: localIso(2026, 4, 10), totalAmount: 100 }),
      baseReceipt({ id: '2', date: localIso(2026, 5, 10), totalAmount: 150 }),
    ];
    const r = monthOverMonthDelta(receipts, 2026, 5);
    expect(r.thisMonth.total).toBe(150);
    expect(r.prevMonth.total).toBe(100);
    expect(r.delta).toBe(50);
    expect(r.deltaPct).toBeCloseTo(0.5, 5);
  });

  it('returns null pct when previous month had zero spend', () => {
    const receipts = [
      baseReceipt({ id: '1', date: localIso(2026, 5, 10), totalAmount: 100 }),
    ];
    const r = monthOverMonthDelta(receipts, 2026, 5);
    expect(r.prevMonth.total).toBe(0);
    expect(r.delta).toBe(100);
    expect(r.deltaPct).toBeNull();
  });

  it('handles January correctly (rolls back to December of previous year)', () => {
    const receipts = [
      baseReceipt({ id: '1', date: localIso(2025, 12, 20), totalAmount: 80 }),
      baseReceipt({ id: '2', date: localIso(2026, 1, 15), totalAmount: 120 }),
    ];
    const r = monthOverMonthDelta(receipts, 2026, 1);
    expect(r.prevMonth.year).toBe(2025);
    expect(r.prevMonth.month).toBe(12);
    expect(r.prevMonth.total).toBe(80);
    expect(r.thisMonth.total).toBe(120);
    expect(r.delta).toBe(40);
  });
});

describe('monthlyTrend', () => {
  it('returns N consecutive months including empty ones', () => {
    const receipts = [
      baseReceipt({ date: localIso(2026, 3, 5), totalAmount: 30 }),
      baseReceipt({ date: localIso(2026, 5, 12), totalAmount: 80 }),
    ];
    const trend = monthlyTrend(receipts, 2026, 5, 4);
    expect(trend).toHaveLength(4);
    expect(trend.map((b) => b.key)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ]);
    expect(trend[0].total).toBe(0); // Feb empty
    expect(trend[1].total).toBe(30); // Mar
    expect(trend[2].total).toBe(0); // Apr empty
    expect(trend[3].total).toBe(80); // May
  });

  it('shortLabel uses the 3-letter month abbreviation', () => {
    const trend = monthlyTrend([], 2026, 5, 3);
    expect(trend.map((b) => b.shortLabel)).toEqual(['Mar', 'Apr', 'May']);
  });

  it('crosses year boundaries correctly', () => {
    const trend = monthlyTrend([], 2026, 2, 4);
    expect(trend.map((b) => b.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('topStores', () => {
  it('ranks by total spend, then visit count, then name', () => {
    const receipts = [
      baseReceipt({ storeName: 'Costco', totalAmount: 200 }),
      baseReceipt({ storeName: 'Costco', totalAmount: 100 }),
      baseReceipt({ storeName: 'Walmart', totalAmount: 250 }),
      baseReceipt({ storeName: 'Target', totalAmount: 100 }),
      baseReceipt({ storeName: 'Target', totalAmount: 50 }),
    ];
    const result = topStores(receipts, 3);
    expect(result[0]).toEqual({ storeName: 'Costco', total: 300, count: 2 });
    expect(result[1]).toEqual({ storeName: 'Walmart', total: 250, count: 1 });
    expect(result[2]).toEqual({ storeName: 'Target', total: 150, count: 2 });
  });

  it('limits the output to N rows', () => {
    const receipts = [
      baseReceipt({ storeName: 'A', totalAmount: 10 }),
      baseReceipt({ storeName: 'B', totalAmount: 20 }),
      baseReceipt({ storeName: 'C', totalAmount: 30 }),
      baseReceipt({ storeName: 'D', totalAmount: 40 }),
    ];
    expect(topStores(receipts, 2)).toHaveLength(2);
    expect(topStores(receipts, 10)).toHaveLength(4);
  });

  it('treats empty store names as "Unknown Store"', () => {
    const receipts = [
      baseReceipt({ storeName: '', totalAmount: 10 }),
      baseReceipt({ storeName: '   ', totalAmount: 5 }),
    ];
    const result = topStores(receipts);
    expect(result[0].storeName).toBe('Unknown Store');
    expect(result[0].total).toBe(15);
    expect(result[0].count).toBe(2);
  });
});
