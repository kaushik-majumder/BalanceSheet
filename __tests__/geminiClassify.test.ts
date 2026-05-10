import { pickCategory } from '../lib/geminiClassify';

describe('pickCategory — parsing Gemini replies', () => {
  it('matches an exact category name', () => {
    expect(pickCategory('Groceries')).toBe('Groceries');
    expect(pickCategory('Electronics')).toBe('Electronics');
    expect(pickCategory('Healthcare')).toBe('Healthcare');
  });

  it('matches case-insensitively', () => {
    expect(pickCategory('groceries')).toBe('Groceries');
    expect(pickCategory('PHARMACY')).toBe('Pharmacy');
  });

  it('strips trailing punctuation, whitespace, and explanations', () => {
    expect(pickCategory('Groceries.')).toBe('Groceries');
    expect(pickCategory('  Pharmacy  ')).toBe('Pharmacy');
    expect(pickCategory('Other!')).toBe('Other');
    expect(pickCategory('The category is Groceries')).toBe('Groceries');
    expect(pickCategory('Item: → Healthcare')).toBe('Healthcare');
  });

  it('falls back to Other on unknown reply', () => {
    expect(pickCategory('Snacks')).toBe('Other');
    expect(pickCategory('I am not sure')).toBe('Other');
    expect(pickCategory('')).toBe('Other');
  });

  it('does not partial-match a longer token', () => {
    expect(pickCategory('GroceriesShop')).toBe('Other');
  });

  it('picks the FIRST recognized category if multiple appear', () => {
    expect(pickCategory('Groceries or Pharmacy')).toBe('Groceries');
  });
});
