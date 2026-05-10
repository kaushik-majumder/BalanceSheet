import { receiptMatchesCategory } from '../lib/receiptFilter';
import { Receipt } from '../types';

const baseReceipt = (overrides: Partial<Receipt>): Receipt => ({
  id: 'r1',
  storeName: 'Test',
  date: new Date().toISOString(),
  totalAmount: 100,
  category: 'Other',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('receiptMatchesCategory', () => {
  it('matches when primary category equals the filter', () => {
    const r = baseReceipt({ category: 'Groceries' });
    expect(receiptMatchesCategory(r, 'Groceries')).toBe(true);
  });

  it('does not match when primary differs and there are no tags or items', () => {
    const r = baseReceipt({ category: 'Groceries' });
    expect(receiptMatchesCategory(r, 'Healthcare')).toBe(false);
  });

  it('matches when categoryTags includes the filter', () => {
    const r = baseReceipt({
      category: 'Groceries',
      categoryTags: ['Groceries', 'Healthcare', 'Pet Food'],
    });
    expect(receiptMatchesCategory(r, 'Healthcare')).toBe(true);
  });

  it('matches when any line item has that category, even if primary differs', () => {
    const r = baseReceipt({
      category: 'Groceries',
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
        { id: '2', name: 'Aspirin', amount: 12, category: 'Pharmacy' },
      ],
    });
    expect(receiptMatchesCategory(r, 'Pharmacy')).toBe(true);
  });

  it('returns false when neither primary, tags, nor items match', () => {
    const r = baseReceipt({
      category: 'Groceries',
      categoryTags: ['Groceries', 'Pet Food'],
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
      ],
    });
    expect(receiptMatchesCategory(r, 'Travel')).toBe(false);
  });

  it('handles missing categoryTags and lineItems gracefully', () => {
    const r = baseReceipt({ category: 'Gas' });
    expect(receiptMatchesCategory(r, 'Gas')).toBe(true);
    expect(receiptMatchesCategory(r, 'Groceries')).toBe(false);
  });

  it('matches multi-category Walmart-style receipt across all its categories', () => {
    // Walmart trip with Groceries + Healthcare + Clothing items.
    const walmart = baseReceipt({
      category: 'Groceries',
      categoryTags: ['Groceries', 'Healthcare', 'Clothing'],
      lineItems: [
        { id: '1', name: 'Milk', amount: 5, category: 'Groceries' },
        { id: '2', name: 'Tylenol', amount: 12, category: 'Pharmacy' },
        { id: '3', name: 'Shoes', amount: 50, category: 'Clothing' },
      ],
    });
    expect(receiptMatchesCategory(walmart, 'Groceries')).toBe(true);
    expect(receiptMatchesCategory(walmart, 'Healthcare')).toBe(true);
    expect(receiptMatchesCategory(walmart, 'Clothing')).toBe(true);
    expect(receiptMatchesCategory(walmart, 'Pharmacy')).toBe(true); // via item
    expect(receiptMatchesCategory(walmart, 'Travel')).toBe(false);
  });
});
