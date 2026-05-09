import { detectCategory } from '../lib/categorizer';

describe('detectCategory', () => {
  it('returns "Other" for empty input', () => {
    expect(detectCategory('', '')).toBe('Other');
  });

  it('returns "Other" when no keywords match', () => {
    expect(detectCategory('Generic Inc', 'Widget purchase')).toBe('Other');
  });

  it('weights store-name matches more heavily than body matches', () => {
    // "pharmacy" in store name should win over a passing mention of "restaurant" in text
    expect(detectCategory('CVS Pharmacy', 'next to restaurant row')).toBe('Pharmacy');
  });

  it('classifies grocery stores', () => {
    expect(detectCategory('Whole Foods', '')).toBe('Groceries');
    expect(detectCategory('Trader Joes', '')).toBe('Groceries');
    expect(detectCategory('Safeway', '')).toBe('Groceries');
  });

  it('classifies electronics stores', () => {
    expect(detectCategory('Best Buy', '')).toBe('Electronics');
    expect(detectCategory('Apple Store', '')).toBe('Electronics');
  });

  it('classifies dining/restaurants', () => {
    expect(detectCategory('Starbucks', '')).toBe('Dining');
    expect(detectCategory('McDonalds', '')).toBe('Dining');
    expect(detectCategory('Pizza Hut', '')).toBe('Dining');
  });

  it('classifies pharmacies', () => {
    expect(detectCategory('Walgreens', '')).toBe('Pharmacy');
    expect(detectCategory('CVS', '')).toBe('Pharmacy');
  });

  it('classifies gas stations', () => {
    expect(detectCategory('Shell', 'gallons of gas')).toBe('Gas');
    expect(detectCategory('Chevron', '')).toBe('Gas');
  });

  it('is case-insensitive', () => {
    expect(detectCategory('WHOLE FOODS', '')).toBe('Groceries');
    expect(detectCategory('whole foods', '')).toBe('Groceries');
  });

  it('falls back to body text when store name has no keyword', () => {
    expect(detectCategory('Unknown Vendor', 'gas station fuel pump')).toBe('Gas');
  });
});
