import { Category } from '../types';
import { CATEGORY_KEYWORDS } from '../constants/categories';

export function detectCategory(storeName: string, text: string): Category {
  const combined = `${storeName} ${text}`.toLowerCase();

  const scores: Record<Category, number> = {
    Groceries: 0, Electronics: 0, Dining: 0, Pharmacy: 0, Gas: 0,
    Clothing: 0, Entertainment: 0, Travel: 0, Healthcare: 0, Other: 0,
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        // Store name matches carry triple weight
        scores[category] += storeName.toLowerCase().includes(keyword.toLowerCase()) ? 3 : 1;
      }
    }
  }

  const top = (Object.entries(scores) as [Category, number][]).sort(([, a], [, b]) => b - a)[0];
  return top[1] > 0 ? top[0] : 'Other';
}
