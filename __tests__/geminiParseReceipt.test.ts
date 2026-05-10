import { parseGeminiPayload } from '../lib/geminiParseReceipt';

describe('parseGeminiPayload — validating Gemini JSON receipt response', () => {
  it('parses a valid full receipt response', () => {
    const json = JSON.stringify({
      store: 'Walmart',
      date: '2026-05-09',
      subtotal: 114.04,
      tax: 13.56,
      total: 127.6,
      items: [
        { name: '10LB NEOPREN', amount: 14.97, category: 'Healthcare' },
        { name: '5LB RUBBER', amount: 9.98, category: 'Healthcare' },
        { name: 'TB CHC CROIS', amount: 5.98, category: 'Groceries' },
      ],
    });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.receipt;
    expect(r.storeName).toBe('Walmart');
    expect(r.totalAmount).toBe(127.6);
    expect(r.subtotalAmount).toBe(114.04);
    expect(r.taxAmount).toBe(13.56);
    expect(r.lineItems.length).toBe(3);
    expect(r.lineItems[0].name).toBe('10LB NEOPREN');
    expect(r.lineItems[0].amount).toBe(14.97);
    expect(r.lineItems[0].category).toBe('Healthcare');
  });

  it('handles null subtotal/tax (receipt without those lines)', () => {
    const json = JSON.stringify({
      store: 'Coffee Shop',
      date: '',
      subtotal: null,
      tax: null,
      total: 5.5,
      items: [{ name: 'Latte', amount: 5.5, category: 'Dining' }],
    });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.subtotalAmount).toBeUndefined();
    expect(result.receipt.taxAmount).toBeUndefined();
  });

  it('skips items missing required fields', () => {
    const json = JSON.stringify({
      store: 'X',
      total: 10,
      items: [
        { name: 'Valid', amount: 10, category: 'Other' },
        { name: '', amount: 1, category: 'Other' }, // empty name → skip
        { name: 'No amount', category: 'Other' }, // missing amount → skip
        { amount: 5, category: 'Other' }, // missing name → skip
      ],
    });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.lineItems.length).toBe(1);
    expect(result.receipt.lineItems[0].name).toBe('Valid');
  });

  it('falls back unknown category to Other', () => {
    const json = JSON.stringify({
      store: 'X',
      total: 10,
      items: [{ name: 'Mystery', amount: 10, category: 'Snacks' }],
    });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.lineItems[0].category).toBe('Other');
  });

  it('coerces numeric strings to numbers', () => {
    const json = JSON.stringify({
      store: 'X',
      total: '127.60',
      subtotal: '114.04',
      tax: '13.56',
      items: [{ name: 'Item', amount: '14.97', category: 'Other' }],
    });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.totalAmount).toBe(127.6);
    expect(result.receipt.subtotalAmount).toBe(114.04);
    expect(result.receipt.lineItems[0].amount).toBe(14.97);
  });

  it('returns ok=false on invalid JSON', () => {
    const result = parseGeminiPayload('not valid json{');
    expect(result.ok).toBe(false);
  });

  it('returns ok=false on non-object reply', () => {
    const result = parseGeminiPayload('"just a string"');
    expect(result.ok).toBe(false);
  });

  it('uses fallback storeName when missing', () => {
    const json = JSON.stringify({ total: 10, items: [] });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.storeName).toBe('Unknown Store');
  });

  it('falls back to today when date is invalid', () => {
    const json = JSON.stringify({
      store: 'X',
      date: 'not a date',
      total: 10,
      items: [],
    });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Should be a valid ISO date string (today)
    expect(() => new Date(result.receipt.date).toISOString()).not.toThrow();
  });

  it('handles empty items array', () => {
    const json = JSON.stringify({ store: 'X', total: 0, items: [] });
    const result = parseGeminiPayload(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.lineItems).toEqual([]);
  });
});
