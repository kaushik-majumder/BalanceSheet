import { categorizeItem, cleanItemName, detectCategory } from '../lib/categorizer';

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

describe('cleanItemName', () => {
  it('strips a 12-digit UPC code from the middle of the name', () => {
    expect(cleanItemName('TB CHC CROIS 770981561170')).toBe('TB CHC CROIS');
  });

  it('strips a trailing single-letter status code (Walmart J/D)', () => {
    expect(cleanItemName('SHRIMP RING J')).toBe('SHRIMP RING');
  });

  it('handles UPC and status letter together', () => {
    expect(cleanItemName('YOGA MAT 840737122350 J')).toBe('YOGA MAT');
  });

  it('collapses extra whitespace', () => {
    expect(cleanItemName('  10LB    NEOPREN  ')).toBe('10LB NEOPREN');
  });

  it('preserves slash and ampersand for things like "salt & pepper"', () => {
    expect(cleanItemName('Salt & Pepper')).toBe('Salt & Pepper');
  });

  it('returns empty for an all-numeric / empty input', () => {
    expect(cleanItemName('123456789012')).toBe('');
    expect(cleanItemName('')).toBe('');
  });
});

describe('categorizeItem', () => {
  it('groceries: croissant', () => {
    expect(categorizeItem('TB CHC CROIS 770981561170')).toBe('Groceries');
  });

  it('groceries: chocolate', () => {
    expect(categorizeItem('MRKIPCHOC 756781003060')).toBe('Groceries');
  });

  it('groceries: shrimp', () => {
    expect(categorizeItem('SHRIMP RING 627735264120')).toBe('Groceries');
  });

  it('healthcare: yoga mat', () => {
    expect(categorizeItem('YOGA MAT 840737122350')).toBe('Healthcare');
  });

  it('healthcare: neoprene dumbbells', () => {
    expect(categorizeItem('10LB NEOPREN 191730242300')).toBe('Healthcare');
  });

  it('healthcare: rubber weights', () => {
    expect(categorizeItem('5LB RUBBER 191730242350')).toBe('Healthcare');
  });

  it('other: household air freshener', () => {
    expect(categorizeItem('AW FRESHMTIC 062338856640')).toBe('Other');
  });

  it('other: unknown abbreviated name falls back gracefully', () => {
    expect(categorizeItem('XYZ123 999999999999')).toBe('Other');
  });

  it('falls back to Other on empty input', () => {
    expect(categorizeItem('')).toBe('Other');
  });

  it('handles plain English item names', () => {
    expect(categorizeItem('Organic Milk 2%')).toBe('Groceries');
    expect(categorizeItem('iPhone Charger Cable')).toBe('Electronics');
  });
});
