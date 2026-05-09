import { parseReceiptText } from '../lib/parser';

describe('parseReceiptText - store name extraction', () => {
  it('uses the first non-noise line as the store name', () => {
    const text = ['Whole Foods Market', '123 Main St', '555-1234', 'Total $42.10'].join('\n');
    expect(parseReceiptText(text).storeName).toBe('Whole Foods Market');
  });

  it('skips phone numbers, addresses, and dates when picking store name', () => {
    const text = [
      '555-123-4567',
      '12/05/2026',
      '42 Oak Avenue',
      'Trader Joes',
      'Total $10.00',
    ].join('\n');
    expect(parseReceiptText(text).storeName).toBe('Trader Joes');
  });

  it('skips greeting/header lines like "Thank you" and "Receipt"', () => {
    const text = ['Thank you for shopping', 'Receipt #4521', 'Best Buy', 'Total $99.99'].join('\n');
    expect(parseReceiptText(text).storeName).toBe('Best Buy');
  });

  it('skips URL lines', () => {
    const text = ['www.example.com', 'CVS Pharmacy', 'Total $15.00'].join('\n');
    expect(parseReceiptText(text).storeName).toBe('CVS Pharmacy');
  });

  it('falls back to "Unknown Store" when no usable line exists', () => {
    expect(parseReceiptText('').storeName).toBe('Unknown Store');
    expect(parseReceiptText('555-1234\n12/05/2026').storeName).toBe('Unknown Store');
  });
});

describe('parseReceiptText - date extraction', () => {
  it('extracts ISO YYYY-MM-DD format', () => {
    const result = parseReceiptText('Some Store\nDate: 2025-03-14\nTotal $5.00');
    expect(result.date.startsWith('2025-03-14')).toBe(true);
  });

  it('extracts MM/DD/YYYY format', () => {
    const result = parseReceiptText('Some Store\n03/14/2025\nTotal $5.00');
    expect(result.date.startsWith('2025-03-14')).toBe(true);
  });

  it('extracts MM-DD-YYYY format', () => {
    const result = parseReceiptText('Some Store\n03-14-2025\nTotal $5.00');
    expect(result.date.startsWith('2025-03-14')).toBe(true);
  });

  it('extracts "Month DD, YYYY" format', () => {
    const result = parseReceiptText('Some Store\nMay 8, 2025\nTotal $5.00');
    expect(result.date.startsWith('2025-05-08')).toBe(true);
  });

  it('extracts "DD Month YYYY" format', () => {
    const result = parseReceiptText('Some Store\n8 May 2025\nTotal $5.00');
    expect(result.date.startsWith('2025-05-08')).toBe(true);
  });

  it('extracts MM/DD/YY (2-digit year) format', () => {
    const result = parseReceiptText('Some Store\n03/14/25\nTotal $5.00');
    expect(result.date.startsWith('2025-03-14')).toBe(true);
  });

  it('falls back to today when no date found', () => {
    const before = Date.now();
    const result = parseReceiptText('Some Store\nTotal $5.00');
    const parsed = new Date(result.date).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before - 1000);
    expect(parsed).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('rejects future dates and falls back to today', () => {
    const result = parseReceiptText('Some Store\n2099-12-31\nTotal $5.00');
    expect(result.date.startsWith('2099')).toBe(false);
  });

  it('rejects dates before year 2000', () => {
    const result = parseReceiptText('Some Store\n1995-06-15\nTotal $5.00');
    expect(result.date.startsWith('1995')).toBe(false);
  });
});

describe('parseReceiptText - total amount extraction', () => {
  it('picks up "Grand Total" with highest priority', () => {
    const text = 'Some Store\nSubtotal $5.00\nGrand Total $42.99\nThanks';
    expect(parseReceiptText(text).totalAmount).toBe(42.99);
  });

  it('picks up "Total Due"', () => {
    expect(parseReceiptText('Store\nTotal Due: $19.50').totalAmount).toBe(19.5);
  });

  it('picks up "Amount Due"', () => {
    expect(parseReceiptText('Store\nAmount Due: 33.00').totalAmount).toBe(33.0);
  });

  it('picks up plain "Total" keyword', () => {
    expect(parseReceiptText('Store\nTotal $7.25').totalAmount).toBe(7.25);
  });

  it('handles total on a line below the keyword', () => {
    const text = 'Store\nItem 1 $5.00\nTotal\n$12.34\nThanks';
    expect(parseReceiptText(text).totalAmount).toBe(12.34);
  });

  it('parses comma thousands separators', () => {
    expect(parseReceiptText('Store\nTotal $1,234.56').totalAmount).toBe(1234.56);
  });

  it('falls back to largest $ amount when no keyword present', () => {
    const text = 'Store\n$3.00\n$15.00\n$8.99';
    expect(parseReceiptText(text).totalAmount).toBe(15.0);
  });

  it('falls back to largest bare decimal when no $ signs', () => {
    const text = 'Store\nItem A 3.00\nItem B 15.00\nItem C 8.99';
    expect(parseReceiptText(text).totalAmount).toBe(15.0);
  });

  it('returns 0 when no amount can be detected', () => {
    expect(parseReceiptText('Store\nNo prices here').totalAmount).toBe(0);
  });

  it('rejects implausibly large amounts (>100,000)', () => {
    const text = 'Store\nTotal $999999.00\n$5.00';
    expect(parseReceiptText(text).totalAmount).toBe(5.0);
  });
});

describe('parseReceiptText - category detection', () => {
  it('classifies grocery store names', () => {
    expect(parseReceiptText('Whole Foods Market\nTotal $20').category).toBe('Groceries');
    expect(parseReceiptText('Trader Joes\nTotal $20').category).toBe('Groceries');
  });

  it('classifies electronics stores', () => {
    expect(parseReceiptText('Best Buy\nLaptop $999.99').category).toBe('Electronics');
  });

  it('classifies pharmacy stores', () => {
    expect(parseReceiptText('CVS Pharmacy\nTotal $15').category).toBe('Pharmacy');
  });

  it('classifies gas stations', () => {
    expect(parseReceiptText('Shell Gas Station\nGallons 12.5\nTotal $45').category).toBe('Gas');
  });

  it('classifies dining/restaurants', () => {
    expect(parseReceiptText('Pizza Hut\nTotal $25').category).toBe('Dining');
  });

  it('returns "Other" when no keywords match', () => {
    expect(parseReceiptText('Generic Inc\nWidget $5').category).toBe('Other');
  });
});

describe('parseReceiptText - line items extraction', () => {
  it('extracts items with prices at the end of the line', () => {
    const text = ['Store', 'Apples 3.00', 'Bread 4.50', 'Total $7.50'].join('\n');
    const items = parseReceiptText(text).lineItems;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: 'Apples', amount: 3.0 });
    expect(items[1]).toMatchObject({ name: 'Bread', amount: 4.5 });
  });

  it('skips lines with total/tax/discount keywords', () => {
    const text = [
      'Store',
      'Apples 3.00',
      'Subtotal 3.00',
      'Tax 0.30',
      'Total 3.30',
      'Discount -0.50',
    ].join('\n');
    const items = parseReceiptText(text).lineItems;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Apples');
  });

  it('caps line items at 25 to prevent runaway parsing', () => {
    const lines = ['Store'];
    for (let i = 0; i < 40; i++) lines.push(`Item${i} 1.00`);
    expect(parseReceiptText(lines.join('\n')).lineItems).toHaveLength(25);
  });

  it('returns empty array when no recognizable items present', () => {
    expect(parseReceiptText('Store\nThanks for visiting').lineItems).toEqual([]);
  });

  it('assigns a unique id to each item', () => {
    const text = ['Store', 'Apples 3.00', 'Bread 4.50'].join('\n');
    const items = parseReceiptText(text).lineItems;
    expect(items[0].id).not.toBe(items[1].id);
    expect(items[0].id).toBeTruthy();
  });
});

describe('parseReceiptText - integration', () => {
  it('parses a realistic grocery receipt end-to-end', () => {
    const text = [
      'Whole Foods Market',
      '123 Market St',
      '555-1234',
      'Date: 2025-04-12',
      '',
      'Organic Apples         4.99',
      'Sourdough Bread        6.50',
      'Almond Milk            3.99',
      '',
      'Subtotal              15.48',
      'Tax                    1.24',
      'Total                $16.72',
      '',
      'Thank you!',
    ].join('\n');

    const r = parseReceiptText(text);
    expect(r.storeName).toBe('Whole Foods Market');
    expect(r.totalAmount).toBe(16.72);
    expect(r.category).toBe('Groceries');
    expect(r.date.startsWith('2025-04-12')).toBe(true);
    expect(r.lineItems.length).toBeGreaterThanOrEqual(3);
  });

  it('handles empty input without throwing', () => {
    const r = parseReceiptText('');
    expect(r.storeName).toBe('Unknown Store');
    expect(r.totalAmount).toBe(0);
    expect(r.lineItems).toEqual([]);
    expect(r.category).toBe('Other');
  });

  it('always returns a valid ISO date string', () => {
    const r = parseReceiptText('garbage input with no date');
    expect(() => new Date(r.date).toISOString()).not.toThrow();
    expect(new Date(r.date).getTime()).not.toBeNaN();
  });
});
