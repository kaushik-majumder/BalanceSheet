import { Category, LineItem, Receipt } from '../types';

export type CategoryDrilldownGroup = {
  receiptId: string;
  storeName: string;
  date: string;
  /** Just the items in the requested category (or the only entry — see
   *  fallback rules below). */
  items: LineItem[];
  /** Sum of the matching items' amounts for this receipt. */
  subtotal: number;
  /** True when this group came from the receipt-level fallback (no
   *  line items existed) — UI can show a "whole receipt" hint. */
  isWholeReceipt: boolean;
};

export type CategoryDrilldownResult = {
  category: Category | string;
  /** Sum of every group's subtotal — what the user sees at the top. */
  totalSpent: number;
  groups: CategoryDrilldownGroup[];
};

/**
 * For a given category, gather every receipt that contributed to it and
 * extract the matching items.
 *
 * Match rules per receipt (in order — first hit wins):
 *   1. The receipt has line items → keep only the items whose category
 *      equals the requested one. If none match but the receipt's primary
 *      category equals the requested one, fall back to rule 3.
 *   2. The receipt has no line items but its primary `category` matches
 *      → attribute the WHOLE receipt total to this category (a synthetic
 *      single-line group).
 *
 * Receipts that match neither are excluded.
 */
export function buildCategoryDrilldown(
  receipts: Receipt[],
  category: Category | string,
): CategoryDrilldownResult {
  const groups: CategoryDrilldownGroup[] = [];

  for (const r of receipts) {
    if (r.lineItems && r.lineItems.length > 0) {
      const matching = r.lineItems.filter((i) => i.category === category);
      if (matching.length > 0) {
        groups.push({
          receiptId: r.id,
          storeName: r.storeName,
          date: r.date,
          items: matching,
          subtotal: matching.reduce((s, i) => s + i.amount, 0),
          isWholeReceipt: false,
        });
      }
      continue;
    }
    // No line items — fall back to receipt-level category match.
    if (r.category === category) {
      groups.push({
        receiptId: r.id,
        storeName: r.storeName,
        date: r.date,
        items: [],
        subtotal: r.totalAmount,
        isWholeReceipt: true,
      });
    }
  }

  // Most-recent receipts first (consistent with History tab).
  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    category,
    totalSpent: groups.reduce((s, g) => s + g.subtotal, 0),
    groups,
  };
}
