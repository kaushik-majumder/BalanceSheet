import { CategorySummary, MonthlyStats, Receipt } from '../types';

/**
 * Aggregate a list of receipts into the headline + per-category breakdown
 * the dashboard renders. Per-category totals are computed from line items
 * when available so a multi-category receipt (e.g. a Costco trip with
 * groceries + clothing + home goods) attributes spend across categories
 * proportionally.
 *
 * To keep the per-category total summing to the receipt total, item
 * amounts are scaled by `receipt.totalAmount / sum_of_item_amounts` —
 * this redistributes tax/rounding in proportion to each item's amount.
 *
 * Receipts without line items fall back to attributing the full total
 * to the receipt's primary category (legacy behaviour for old data).
 */
export function computeStats(receipts: Receipt[]): MonthlyStats {
  const total = receipts.reduce((s, r) => s + r.totalAmount, 0);
  const catMap: Record<string, { total: number; count: number }> = {};

  for (const r of receipts) {
    if (r.lineItems && r.lineItems.length > 0) {
      const itemSum = r.lineItems.reduce((s, i) => s + Math.abs(i.amount), 0);
      const scale = itemSum > 0 ? r.totalAmount / itemSum : 1;
      const seenInThisReceipt = new Set<string>();
      for (const item of r.lineItems) {
        const cat = (item.category ?? r.category) as string;
        if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
        catMap[cat].total += Math.abs(item.amount) * scale;
        if (!seenInThisReceipt.has(cat)) {
          catMap[cat].count += 1;
          seenInThisReceipt.add(cat);
        }
      }
    } else {
      const cat = r.category as string;
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
      catMap[cat].total += r.totalAmount;
      catMap[cat].count += 1;
    }
  }

  const categories: CategorySummary[] = Object.entries(catMap).map(
    ([category, { total: catTotal, count }]) => ({
      category,
      total: catTotal,
      count,
      percentage: total > 0 ? (catTotal / total) * 100 : 0,
    }),
  );

  categories.sort((a, b) => b.total - a.total);
  const topCategory = categories[0]?.category ?? null;

  return {
    totalSpent: total,
    receiptCount: receipts.length,
    topCategory,
    avgPerReceipt: receipts.length > 0 ? total / receipts.length : 0,
    categories,
  };
}
