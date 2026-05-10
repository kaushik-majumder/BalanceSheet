import { pickCategory } from '../lib/anthropicClassify';

describe('pickCategory — parsing Anthropic replies', () => {
  it('matches an exact category name', () => {
    expect(pickCategory('Groceries')).toBe('Groceries');
    expect(pickCategory('Electronics')).toBe('Electronics');
    expect(pickCategory('Healthcare')).toBe('Healthcare');
  });

  it('matches case-insensitively', () => {
    expect(pickCategory('groceries')).toBe('Groceries');
    expect(pickCategory('PHARMACY')).toBe('Pharmacy');
  });

  it('strips trailing punctuation and whitespace', () => {
    expect(pickCategory('Groceries.')).toBe('Groceries');
    expect(pickCategory('  Pharmacy  ')).toBe('Pharmacy');
    expect(pickCategory('Other!')).toBe('Other');
  });

  it('extracts category from a verbose reply', () => {
    expect(pickCategory('The category is Groceries')).toBe('Groceries');
    expect(pickCategory('Item: → Healthcare')).toBe('Healthcare');
  });

  it('falls back to Other on unknown reply', () => {
    expect(pickCategory('Snacks')).toBe('Other');
    expect(pickCategory('I am not sure')).toBe('Other');
    expect(pickCategory('')).toBe('Other');
  });

  it('does not partial-match (e.g. "GroceriesShop" should not match Groceries)', () => {
    // Word-boundary regex means a contiguous longer token like
    // "GroceriesAndMore" without spaces won't match. With our regex
    // ([^A-Za-z]+ collapsed to spaces) it WILL still match because the
    // sequence becomes 'GroceriesAndMore' as a single token; \b sits
    // between the e and A only if A is non-word, but A is a letter.
    expect(pickCategory('GroceriesShop')).toBe('Other');
  });

  it('picks the FIRST recognized category if multiple appear', () => {
    expect(pickCategory('Groceries or Pharmacy')).toBe('Groceries');
  });
});
