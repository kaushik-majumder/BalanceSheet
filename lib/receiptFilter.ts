import { Category, Receipt } from '../types';

/**
 * Whether a receipt should appear under the given category filter.
 *
 * A receipt matches when ANY of these is true:
 *   - its primary `category` equals the filter
 *   - any of its `categoryTags` equals the filter (multi-tag)
 *   - any of its line items has that category (item-level match)
 *
 * This is the inverse of how the dashboard breakdown attributes spend:
 * a receipt that contributed to a category's slice shows up under that
 * category's filter.
 */
export function receiptMatchesCategory(
  receipt: Receipt,
  category: Category,
): boolean {
  if (receipt.category === category) return true;
  if (receipt.categoryTags?.includes(category)) return true;
  if (receipt.lineItems?.some((item) => item.category === category)) return true;
  return false;
}
