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
      // Use signed (not absolute) sums so discount/markdown lines
      // SUBTRACT from their category total rather than add to it. The
      // pre-merge bug was: `Math.abs(-15)` made a -$15 TPD discount
      // contribute +$15 to "Other", double-counting the EKO MIRROR
      // it was supposed to discount.
      //
      // Scale by net sum so per-category totals still add up to the
      // receipt total (tax distributed proportionally across items).
      // Falls back to scale=1 when the net is non-positive (a fully
      // refunded receipt or impossible state).
      const itemNet = r.lineItems.reduce((s, i) => s + i.amount, 0);
      const scale = itemNet > 0 ? r.totalAmount / itemNet : 1;
      const seenInThisReceipt = new Set<string>();
      for (const item of r.lineItems) {
        const cat = (item.category ?? r.category) as string;
        if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
        catMap[cat].total += item.amount * scale;
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
