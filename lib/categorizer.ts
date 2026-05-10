import { Category } from '../types';
import { CATEGORY_KEYWORDS, ITEM_CATEGORY_HINTS } from '../constants/categories';

/**
 * Detect the category for a whole receipt based on store name and full text.
 * Store-name matches carry triple weight.
 */
export function detectCategory(storeName: string, text: string): Category {
  const combined = `${storeName} ${text}`.toLowerCase();
  const storeLower = storeName.toLowerCase();

  const scores: Record<Category, number> = {
    Groceries: 0, Electronics: 0, Dining: 0, Pharmacy: 0, Gas: 0,
    Clothing: 0, Entertainment: 0, Travel: 0, Healthcare: 0, Other: 0,
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    for (const keyword of keywords) {
      const k = keyword.toLowerCase();
      if (combined.includes(k)) {
        scores[category] += storeLower.includes(k) ? 3 : 1;
      }
    }
  }

  const top = (Object.entries(scores) as [Category, number][]).sort(([, a], [, b]) => b - a)[0];
  return top[1] > 0 ? top[0] : 'Other';
}

/**
 * Strip noise from a line-item name before keyword matching:
 *  - 8–14 digit UPC / SKU codes
 *  - trailing single status letter (Walmart 'J' / 'D', Costco 'E', etc.)
 *  - leading/trailing punctuation and collapsed whitespace
 */
export function cleanItemName(name: string): string {
  return name
    .replace(/\b\d{8,14}\b/g, ' ')          // UPC / SKU
    .replace(/\s+[A-Z]\s*$/, ' ')           // trailing single status letter
    .replace(/[^a-zA-Z0-9 .'/&-]+/g, ' ')   // stray punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Categorize a single line item by name. Layers ITEM_CATEGORY_HINTS over
 * CATEGORY_KEYWORDS for better recall on abbreviated grocery-receipt names.
 */
export function categorizeItem(name: string): Category {
  const cleaned = cleanItemName(name).toLowerCase();
  if (!cleaned) return 'Other';

  const scores: Record<Category, number> = {
    Groceries: 0, Electronics: 0, Dining: 0, Pharmacy: 0, Gas: 0,
    Clothing: 0, Entertainment: 0, Travel: 0, Healthcare: 0, Other: 0,
  };

  // Hints first — they are tuned for line-item naming and weight more heavily.
  for (const [category, hints] of Object.entries(ITEM_CATEGORY_HINTS) as [
    Category,
    string[],
  ][]) {
    for (const hint of hints ?? []) {
      if (cleaned.includes(hint.toLowerCase())) scores[category] += 2;
    }
  }

  // Then store-level keywords as a weaker signal — skip Travel/Gas/Clothing
  // store names which would noise-match item names like "GAP" inside "GAPPED".
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    Category,
    string[],
  ][]) {
    if (category === 'Other') continue;
    for (const keyword of keywords) {
      const k = keyword.toLowerCase();
      // Only match keywords of meaningful length; bare "gap" / "next" are noisy.
      if (k.length < 4) continue;
      if (cleaned.includes(k)) scores[category] += 1;
    }
  }

  const top = (Object.entries(scores) as [Category, number][]).sort(
    ([, a], [, b]) => b - a,
  )[0];
  return top[1] > 0 ? top[0] : 'Other';
}
