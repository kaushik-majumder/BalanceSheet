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

  it('caps line items at 50 to prevent runaway parsing on huge receipts', () => {
    const lines = ['Store'];
    for (let i = 0; i < 80; i++) lines.push(`Item${i} 1.00`);
    expect(parseReceiptText(lines.join('\n')).lineItems).toHaveLength(50);
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

describe('parseReceiptText - categoryTags derivation', () => {
  it('derives unique tags from line item categories', () => {
    const text = [
      'Walmart',
      'YOGA MAT 21.98',     // Healthcare
      'TB CHC CROIS 5.98',  // Groceries
      'SHRIMP RING 4.97',   // Groceries (duplicate of Groceries)
      'Total 32.93',
    ].join('\n');
    const tags = parseReceiptText(text).categoryTags ?? [];
    expect(tags).toContain('Healthcare');
    expect(tags).toContain('Groceries');
    expect(tags.length).toBe(2);  // unique
  });

  it('falls back to receipt-level category when no items have tags', () => {
    const text = ['Walmart', 'Total 1.00'].join('\n');
    const tags = parseReceiptText(text).categoryTags ?? [];
    expect(tags.length).toBeGreaterThan(0);
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

describe('parseReceiptText - Walmart-style receipt with UPCs and HST', () => {
  // Real-world Walmart receipt: each item line ends with a 12-digit UPC code,
  // the price, and a single-letter tax-status flag (J / D). HST is a Canadian
  // sales tax that should be extracted separately from the grand total.
  const walmartText = [
    'Walmart',
    'STORE 3001',
    '270 KINGSTON RD E. R.R # 1',
    'AJAX, ON  L1Z 1G1',
    '905-426-6160',
    'ST# 03001 OP# 009053 TE# 53 TR# 01327',
    '10LB NEOPREN 191730242300       14.97 J',
    '10LB NEOPREN 191730242300       14.97 J',
    '5LB RUBBER 191730242350         9.98 J',
    '5LB RUBBER 191730242350         9.98 J',
    'AW FRESHMTIC 062338856640       12.47 J',
    'TB CHC CROIS 770981561170       5.98 D',
    'YOGA MAT 840737122350           21.98 J',
    'PR CF DRY TL 841421125960       9.97 J',
    'CO OPP BB S7 697678203208       5.00 J',
    'MRKIPCHOC 756781003060          3.77 D',
    'SHRIMP RING 627735264120        4.97 J',
    'SUBTOTAL                        114.04',
    'HST 13.0000 %                   13.56',
    'TOTAL                           127.60',
    'MCARD TEND                      127.60',
    'CHANGE DUE                       0.00',
  ].join('\n');

  it('detects Walmart as the store', () => {
    const r = parseReceiptText(walmartText);
    expect(r.storeName.toLowerCase()).toContain('walmart');
  });

  it('strips trailing OCR garbage from the store name', () => {
    const noisy = `Walmart >%\n${walmartText.split('\n').slice(1).join('\n')}`;
    expect(parseReceiptText(noisy).storeName).toBe('Walmart');
  });

  // Real photo from a phone scan included a Mac keyboard background, so
  // OCR returned "option", "return", "shift" before the receipt text.
  // The store-name extractor must prefer the chain name over keyboard keys.
  it('prefers a known chain over keyboard / UI noise lines', () => {
    const ocr = [
      'option',
      'return',
      'shift',
      'Walmart',
      'STORE 3001',
      '270 KINGSTON RD',
    ].join('\n');
    expect(parseReceiptText(ocr).storeName).toBe('Walmart');
  });

  it('falls back to a non-noise heuristic when no known chain is found', () => {
    const ocr = [
      'option',
      'return',
      'Acme Corner Store',
      '123 Some St',
    ].join('\n');
    expect(parseReceiptText(ocr).storeName).toBe('Acme Corner Store');
  });

  it('extracts the grand total ($127.60), not the subtotal or tax line', () => {
    expect(parseReceiptText(walmartText).totalAmount).toBe(127.6);
  });

  it('extracts HST as taxAmount ($13.56), separate from total', () => {
    expect(parseReceiptText(walmartText).taxAmount).toBe(13.56);
  });

  it('extracts the subtotal ($114.04)', () => {
    expect(parseReceiptText(walmartText).subtotalAmount).toBe(114.04);
  });

  it('extracts all 11 line items', () => {
    expect(parseReceiptText(walmartText).lineItems).toHaveLength(11);
  });

  it('strips UPC codes from item names', () => {
    const items = parseReceiptText(walmartText).lineItems;
    for (const item of items) {
      expect(item.name).not.toMatch(/\d{8,14}/);
    }
  });

  it('strips trailing status letter from item names', () => {
    const items = parseReceiptText(walmartText).lineItems;
    for (const item of items) {
      expect(item.name).not.toMatch(/\s+[A-Z]$/);
    }
  });

  it('every line item has a category assigned', () => {
    const items = parseReceiptText(walmartText).lineItems;
    for (const item of items) {
      expect(item.category).toBeDefined();
    }
  });

  it('item subtotals across categories sum to the receipt subtotal', () => {
    const items = parseReceiptText(walmartText).lineItems;
    const sum = items.reduce((s, i) => s + i.amount, 0);
    expect(sum).toBeCloseTo(114.04, 2);
  });

  it('food items (croissant, chocolate, shrimp) categorize as Groceries', () => {
    const items = parseReceiptText(walmartText).lineItems;
    const crois = items.find((i) => /crois/i.test(i.name));
    const chocolate = items.find((i) => /choc/i.test(i.name));
    const shrimp = items.find((i) => /shrimp/i.test(i.name));
    expect(crois?.category).toBe('Groceries');
    expect(chocolate?.category).toBe('Groceries');
    expect(shrimp?.category).toBe('Groceries');
  });

  it('fitness items (neoprene weights, yoga mat, rubber) categorize as Healthcare', () => {
    const items = parseReceiptText(walmartText).lineItems;
    const yoga = items.find((i) => /yoga/i.test(i.name));
    const neopren = items.find((i) => /neopren/i.test(i.name));
    expect(yoga?.category).toBe('Healthcare');
    expect(neopren?.category).toBe('Healthcare');
  });

  it('does not pick up the SUBTOTAL/HST/TOTAL/TEND lines as items', () => {
    const items = parseReceiptText(walmartText).lineItems;
    for (const item of items) {
      expect(item.name).not.toMatch(/total|hst|tend|change/i);
    }
  });
});

describe('parseReceiptText - two-column OCR (names and prices on separate lines)', () => {
  // Real OCR output from a phone-camera scan of the same Walmart receipt.
  // ML Kit returned the left column (item names + UPCs) as one block, then
  // the right column (prices) as a second block. The parser must pair
  // name[i] with price[i].
  const twoColumnOcr = [
    'Walmart',
    'STORE 3001',
    '270 KINGSTON RD ERR# 1',
    'AJAX, ON',
    'L1Z 1G1',
    '905-426-6160',
    'ST# 03001 OP# 009053 TE# 53',
    'TR# 01327',
    '10LB NEOPREN 191730242300',
    '10LB NEOPREN 191730242300',
    '5LB RUBBER 191730242350',
    '5LB RUBBER 191730242350',
    'AW FRESHMTIC 062338856640',
    'TB CHC CROIS 770981561170',
    'YOGA MAT 840737122350',
    'PR CF DRY TL 841421125960',
    'CO OPP BB S7 697678203208',
    'MRKIPCHOC 756781003060',
    'SHRIMP RING 627735264120',
    '$14.97 J',
    '$14.97 J',
    '$9.98 J',
    '$9.98 J',
    '$12.47 J',
    '$5.98 D',
    '$21.98 J',
    '$9.97 J',
    '$5.00 J',
    '$3.77 D',
    '$4.97 J',
    'SUBTOTAL $114.04',
    'HST 13.0000% $13.56',
    'TOTAL $127.60',
  ].join('\n');

  it('extracts all 11 line items by pairing names with later price lines', () => {
    const r = parseReceiptText(twoColumnOcr);
    expect(r.lineItems.length).toBe(11);
  });

  it('still extracts the grand total ($127.60) from the totals block', () => {
    expect(parseReceiptText(twoColumnOcr).totalAmount).toBe(127.6);
  });

  it('still extracts subtotal and tax from the totals block', () => {
    const r = parseReceiptText(twoColumnOcr);
    expect(r.subtotalAmount).toBe(114.04);
    expect(r.taxAmount).toBe(13.56);
  });

  it('pairs item names with the right prices in order', () => {
    const items = parseReceiptText(twoColumnOcr).lineItems;
    expect(items[0].name).toMatch(/neopren/i);
    expect(items[0].amount).toBe(14.97);
    expect(items[6]?.name).toMatch(/yoga/i);
    expect(items[6]?.amount).toBe(21.98);
    expect(items[10]?.name).toMatch(/shrimp/i);
    expect(items[10]?.amount).toBe(4.97);
  });

  it('strips UPC codes from paired names', () => {
    const items = parseReceiptText(twoColumnOcr).lineItems;
    for (const item of items) {
      expect(item.name).not.toMatch(/\d{8,14}/);
    }
  });

  it('item subtotals sum to ~ $114.04', () => {
    const sum = parseReceiptText(twoColumnOcr).lineItems.reduce(
      (s, i) => s + i.amount,
      0,
    );
    expect(sum).toBeCloseTo(114.04, 2);
  });

  it('drops Canadian postal codes like "L1Z 1G1" from the items list', () => {
    const ocr = [
      'Walmart',
      '270 KINGSTON RD',
      'AJAX, ON',
      'L1Z 1G1',
      '10LB NEOPREN 191730242300',
      '5LB RUBBER 191730242350',
      'YOGA MAT 840737122350',
      '$14.97',
      '$9.98',
      '$21.98',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(3);
    for (const item of items) {
      expect(item.name).not.toMatch(/L1Z|1G1/);
    }
  });

  it('drops bank/EMV reference rows like "RRN 613051 344514"', () => {
    const ocr = [
      'Walmart',
      '10LB NEOPREN 191730242300',
      'YOGA MAT 840737122350',
      '$14.97',
      '$21.98',
      'RRN 613051 344514',
      'AID A0000000041010',
      'TC 6C57B8FA60B28743',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.name).not.toMatch(/RRN|AID|TC\b/);
    }
  });

  // AID and TC are EMV tags whose values are alphanumeric hex (start
  // with letters, e.g. "A0000000041010" or "6C57B8FA60B28743"). The
  // simple "label + 3+ digits" pattern misses them; we have a separate
  // hex-aware skip rule.
  it('drops AID with hex value starting with a letter ("AID A0000000041010")', () => {
    const ocr = [
      'Walmart',
      'YOGA MAT 840737122350',
      '$21.98',
      'AID A0000000041010',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(1);
    expect(items[0].name).toMatch(/yoga/i);
  });

  it('drops "No Signature Required" payment-block line', () => {
    const ocr = [
      'Walmart',
      'YOGA MAT 840737122350',
      '$21.98',
      'No Signature Required',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(1);
    for (const item of items) {
      expect(item.name).not.toMatch(/signature/i);
    }
  });

  it('treats "5.00 d" (lowercase tax-status letter) as a price, not a name', () => {
    // Real OCR sometimes returns the trailing tax-status flag in
    // lowercase ("d" instead of "D"). Earlier the regex required
    // uppercase, so the line was buffered as a name and the matching
    // item got paired with the WRONG price.
    const ocr = [
      'Walmart',
      'YOGA MAT 840737122350',
      'CO OPP BB S7 697678203208',
      '$21.98 J',
      '5.00 d',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(2);
    expect(items[0].amount).toBe(21.98);
    expect(items[1].amount).toBe(5.0);
    for (const item of items) {
      expect(item.name).not.toMatch(/^[\d.]+\s*[a-z]?$/i);
    }
  });

  it('drops subtotal if same-line regex captures a value greater than total', () => {
    // Defensive: if SUBTOTAL gets matched against the grand-total amount
    // (because OCR mixed up columns), don't trust it. Better to leave
    // subtotal undefined than to display "Subtotal $127.60 / Total $127.60".
    const ocr = [
      'Walmart',
      '10LB NEOPREN 191730242300 14.97',
      'SUBTOTAL 127.60',
      'TOTAL 127.60',
    ].join('\n');
    const r = parseReceiptText(ocr);
    expect(r.totalAmount).toBe(127.6);
    expect(r.subtotalAmount).toBeUndefined();
  });

  it('drops Costco-specific markers (Bottom of basket, BOB count, Member, AMOUNT)', () => {
    const ocr = [
      'Costco',
      'ZV Member 111965941177',
      '1420528 VEGGIES PK 4 14.99',
      '*****Bottom of basket*****',
      '*****BOB Count*****',
      '5220007 BENCH SANDAL 49.99',
      'AMOUNT: $210.17',
      'Items Sold: 7',
      'XXXXXXXXXXXX0933',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    // Should pick up only the 2 real items, not the markers/header noise.
    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.name).not.toMatch(
        /amount|member|basket|bob|items?\s+sold|x{4,}/i,
      );
    }
  });

  it('does not over-match: "First Aid Kit" survives the AID skip', () => {
    // 'First Aid Kit' contains 'aid' but Kit isn't 8+ hex chars, so the
    // EMV-style rule shouldn't fire. The line itself isn't picked as an
    // item here because it has no price, but it shouldn't be treated as
    // skipped if it had been part of a real line item like "First Aid Kit 12.99".
    const ocr = ['Walmart', 'First Aid Kit 12.99'].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(1);
    expect(items[0].name).toMatch(/first aid kit/i);
  });

  // skipRe must catch transaction-id rows even when OCR drops the '#'.
  it('drops transaction-id rows like "ST 03001 OP 009053 TE 53" with no #', () => {
    const ocr = [
      'Walmart',
      'STORE 3001',
      '270 KINGSTON RD',
      'AJAX, ON',
      'ST 03001 OP 009053 TE 53',  // OCR dropped the # symbols
      'TR 01327',
      '10LB NEOPREN 191730242300',
      '5LB RUBBER 191730242350',
      'YOGA MAT 840737122350',
      '$14.97',
      '$9.98',
      '$21.98',
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(3);
    for (const item of items) {
      expect(item.name).not.toMatch(/ST 03001|OP 009053|TE 53|TR 01327/);
    }
  });

  // tax regex must not splice "13.00" out of a rate string like "13.0000".
  it('extracts HST $13.56 even when the rate is written "13.0000 %"', () => {
    const ocr = [
      'Walmart',
      'TR 01327',
      '10LB NEOPREN 191730242300',
      'SUBTOTAL',
      'HST 13.0000 %',
      'TOTAL',
      '$14.97',
      '$14.97',
      '$1.95',
      '$16.92',
    ].join('\n');
    expect(parseReceiptText(ocr).taxAmount).toBe(1.95);
  });

  // the totals amounts (subtotal, tax, total) must NOT be paired with items.
  it('does not pair the subtotal/tax/total amounts as item prices', () => {
    const ocr = [
      'Walmart',
      'TR 01327',
      '10LB NEOPREN 191730242300',
      '5LB RUBBER 191730242350',
      'YOGA MAT 840737122350',
      'SUBTOTAL',
      'HST 13.0000%',
      'TOTAL',
      '$14.97',
      '$9.98',
      '$21.98',
      '$46.93',  // subtotal
      '$6.10',   // tax
      '$53.03',  // total
    ].join('\n');
    const items = parseReceiptText(ocr).lineItems;
    expect(items.length).toBe(3);
    const amounts = items.map((i) => i.amount);
    expect(amounts).not.toContain(46.93);
    expect(amounts).not.toContain(6.10);
    expect(amounts).not.toContain(53.03);
    expect(amounts).toEqual([14.97, 9.98, 21.98]);
  });

  // The actual phone OCR puts the totals labels (SUBTOTAL / HST / TOTAL)
  // at the END of the names block, BEFORE the prices block. Earlier
  // versions of the parser broke out at "HST" and discarded every item
  // price. This case asserts the pairer keeps going.
  it('survives totals labels appearing inside the names block', () => {
    const ocr = [
      'Walmart',
      'STORE 3001',
      '270 KINGSTON RD',
      'AJAX, ON',
      '10LB NEOPREN 191730242300',
      '5LB RUBBER 191730242350',
      'YOGA MAT 840737122350',
      'SUBTOTAL',
      'HST 13.0000%',
      'TOTAL',
      '$14.97',
      '$9.98',
      '$21.98',
      '$46.93',
      '$6.10',
      '$53.03',
    ].join('\n');
    const r = parseReceiptText(ocr);
    expect(r.lineItems.length).toBe(3);
    expect(r.lineItems[0].name).toMatch(/neopren/i);
    expect(r.lineItems[0].amount).toBe(14.97);
    expect(r.lineItems[2].name).toMatch(/yoga/i);
    expect(r.lineItems[2].amount).toBe(21.98);
  });
});
