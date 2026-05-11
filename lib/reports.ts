import { Category, Receipt } from '../types';

/**
 * Pure analytics over a list of receipts. None of these functions
 * touch the database directly — pass them whatever subset of receipts
 * you want analyzed (typically the result of getAllReceipts()).
 *
 * All amounts use raw signed item sums (matching the dashboard's
 * post-fix behavior — see lib/dashboardStats.ts) so category totals
 * are internally consistent across screens.
 */

export type MonthBucket = {
  /** "2026-05" — convenient ISO-like key for grouping. */
  key: string;
  year: number;
  month: number; // 1-12
  /** "May 2026" — humanized label for chart axes. */
  label: string;
  /** "May" — short label for compact charts. */
  shortLabel: string;
  total: number;
  receiptCount: number;
};

export type MonthlySummary = {
  year: number;
  month: number;
  total: number;
  receiptCount: number;
  /** Sorted descending by total. */
  categories: Array<{ category: Category | string; total: number }>;
  topCategory: { category: Category | string; total: number } | null;
  avgPerReceipt: number;
  biggestReceipt: {
    receiptId: string;
    storeName: string;
    date: string;
    total: number;
  } | null;
  biggestItem: {
    receiptId: string;
    storeName: string;
    itemName: string;
    amount: number;
  } | null;
};

export type MonthOverMonthDelta = {
  thisMonth: MonthlySummary;
  prevMonth: MonthlySummary;
  /** Absolute change (thisMonth.total - prevMonth.total). */
  delta: number;
  /** Percentage change as a fraction (0.15 = +15%). null when prevMonth had no spend. */
  deltaPct: number | null;
};

export type TopStore = {
  storeName: string;
  total: number;
  count: number;
};

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

function getReceiptYearMonth(r: Receipt): { year: number; month: number } {
  const d = new Date(r.date);
  // Use LOCAL time — matches the rest of the app's wall-clock semantics
  // since lib/parser.ts now constructs dates in local time.
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function categoryTotalsFor(receipts: Receipt[]): Map<string, number> {
  // Same aggregation policy as lib/dashboardStats.ts: signed item-level
  // sums when items exist, else the receipt's primary category total.
  const m = new Map<string, number>();
  for (const r of receipts) {
    if (r.lineItems && r.lineItems.length > 0) {
      for (const it of r.lineItems) {
        const cat = (it.category ?? r.category) as string;
        m.set(cat, (m.get(cat) ?? 0) + it.amount);
      }
    } else {
      const cat = r.category as string;
      m.set(cat, (m.get(cat) ?? 0) + r.totalAmount);
    }
  }
  return m;
}

/**
 * Summarize one specific calendar month worth of receipts.
 * Caller is responsible for filtering down to that month — typically
 * `getReceiptsByMonth(year, month)` or filtering the full list.
 */
export function summarizeMonth(
  receipts: Receipt[],
  year: number,
  month: number,
): MonthlySummary {
  const total = receipts.reduce((s, r) => s + r.totalAmount, 0);
  const receiptCount = receipts.length;

  const catMap = categoryTotalsFor(receipts);
  const categories = Array.from(catMap.entries())
    .map(([category, t]) => ({ category, total: t }))
    .sort((a, b) => b.total - a.total);
  const topCategory = categories[0] ?? null;

  let biggestReceipt: MonthlySummary['biggestReceipt'] = null;
  for (const r of receipts) {
    if (!biggestReceipt || r.totalAmount > biggestReceipt.total) {
      biggestReceipt = {
        receiptId: r.id,
        storeName: r.storeName,
        date: r.date,
        total: r.totalAmount,
      };
    }
  }

  let biggestItem: MonthlySummary['biggestItem'] = null;
  for (const r of receipts) {
    if (!r.lineItems) continue;
    for (const it of r.lineItems) {
      // Discount/markdown lines (negative amounts) are not the
      // "biggest single purchase" — skip them.
      if (it.amount <= 0) continue;
      if (!biggestItem || it.amount > biggestItem.amount) {
        biggestItem = {
          receiptId: r.id,
          storeName: r.storeName,
          itemName: it.name,
          amount: it.amount,
        };
      }
    }
  }

  return {
    year,
    month,
    total,
    receiptCount,
    categories,
    topCategory,
    avgPerReceipt: receiptCount > 0 ? total / receiptCount : 0,
    biggestReceipt,
    biggestItem,
  };
}

/**
 * Compare a given month against the immediately preceding month and
 * return the delta + percentage change.
 */
export function monthOverMonthDelta(
  allReceipts: Receipt[],
  year: number,
  month: number,
): MonthOverMonthDelta {
  const buckets = bucketByMonth(allReceipts);
  const thisKey = monthKey(year, month);
  const prevDate = new Date(year, month - 2, 1); // month is 1-indexed; subtract 1 to go back, then -1 for ctor
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevKey = monthKey(prevYear, prevMonth);

  const thisRs = buckets.get(thisKey) ?? [];
  const prevRs = buckets.get(prevKey) ?? [];
  const thisMonth = summarizeMonth(thisRs, year, month);
  const prevMonthSum = summarizeMonth(prevRs, prevYear, prevMonth);

  const delta = thisMonth.total - prevMonthSum.total;
  const deltaPct =
    prevMonthSum.total > 0 ? delta / prevMonthSum.total : null;

  return {
    thisMonth,
    prevMonth: prevMonthSum,
    delta,
    deltaPct,
  };
}

function bucketByMonth(receipts: Receipt[]): Map<string, Receipt[]> {
  const m = new Map<string, Receipt[]>();
  for (const r of receipts) {
    const { year, month } = getReceiptYearMonth(r);
    const key = monthKey(year, month);
    const list = m.get(key);
    if (list) list.push(r);
    else m.set(key, [r]);
  }
  return m;
}

/**
 * Build a chronological list of `monthsBack` consecutive month buckets
 * ending at `(year, month)`. Months with no receipts are included with
 * a zero total so the chart shows continuous time.
 */
export function monthlyTrend(
  receipts: Receipt[],
  year: number,
  month: number,
  monthsBack = 6,
): MonthBucket[] {
  const buckets = bucketByMonth(receipts);
  const out: MonthBucket[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const key = monthKey(y, mo);
    const list = buckets.get(key) ?? [];
    const total = list.reduce((s, r) => s + r.totalAmount, 0);
    out.push({
      key,
      year: y,
      month: mo,
      label: monthLabel(y, mo),
      shortLabel: MONTH_SHORT[mo - 1],
      total,
      receiptCount: list.length,
    });
  }
  return out;
}

/**
 * Top N stores across the given receipts by total spend. Ties broken
 * by visit count, then alphabetical.
 */
export function topStores(
  receipts: Receipt[],
  limit = 5,
): TopStore[] {
  const m = new Map<string, { total: number; count: number }>();
  for (const r of receipts) {
    const key = r.storeName.trim() || 'Unknown Store';
    const entry = m.get(key) ?? { total: 0, count: 0 };
    entry.total += r.totalAmount;
    entry.count += 1;
    m.set(key, entry);
  }
  return Array.from(m.entries())
    .map(([storeName, { total, count }]) => ({ storeName, total, count }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.count !== a.count) return b.count - a.count;
      return a.storeName.localeCompare(b.storeName);
    })
    .slice(0, limit);
}
