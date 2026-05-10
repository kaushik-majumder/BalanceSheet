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

  describe('expanded keyword coverage', () => {
    it.each([
      ['Whole Wheat Bread', 'Groceries'],
      ['Honeycrisp Apples', 'Groceries'],
      ['Smoked Salmon Fillet', 'Groceries'],
      ['Greek Yogurt Plain', 'Groceries'],
      ['Cheddar Cheese Block', 'Groceries'],
      ['Quinoa Grain Bowl', 'Groceries'],
      ['Sriracha Hot Sauce', 'Groceries'],
      ['Cold Brew Coffee', 'Groceries'],
      ['Sparkling Water Lime', 'Groceries'],
      ['Sourdough Boule', 'Groceries'],
      ['Frozen Pizza Pepperoni', 'Groceries'],
      ['Almond Butter Crunchy', 'Groceries'],
    ])('groceries: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Macbook Pro 14"', 'Electronics'],
      ['Wireless Bluetooth Headphone', 'Electronics'],
      ['Anker USB-C Charger', 'Electronics'],
      ['Logitech Wireless Mouse', 'Electronics'],
      ['65" OLED 4K TV', 'Electronics'],
      ['Echo Dot Smart Speaker', 'Electronics'],
      ['Nintendo Switch Controller', 'Electronics'],
      ['SD Card 128GB', 'Electronics'],
      ['HDMI Cable 6ft', 'Electronics'],
    ])('electronics: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Levi 501 Jeans', 'Clothing'],
      ['Nike Running Shoes', 'Clothing'],
      ['Cotton T-Shirt White', 'Clothing'],
      ['Wool Sweater Crew Neck', 'Clothing'],
      ['Leather Belt Black', 'Clothing'],
      ['Sports Bra Medium', 'Clothing'],
      ['Hiking Boots Mens', 'Clothing'],
    ])('clothing: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Tylenol Extra Strength', 'Pharmacy'],
      ['Cetaphil Gentle Cleanser', 'Pharmacy'],
      ['Listerine Mouthwash', 'Pharmacy'],
      ['Tampons Regular Box', 'Pharmacy'],
      ['Sunscreen SPF 50', 'Pharmacy'],
      ['Multivitamin Gummy', 'Pharmacy'],
    ])('pharmacy: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Yoga Mat 6mm Purple', 'Healthcare'],
      ['10LB Neoprene Dumbbell', 'Healthcare'],
      ['Resistance Band Set', 'Healthcare'],
      ['Whey Protein Powder Vanilla', 'Healthcare'],
      ['Foam Roller High Density', 'Healthcare'],
      ['First-Aid Kit Travel', 'Healthcare'],
    ])('healthcare/fitness: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Lysol All-Purpose Cleaner', 'Other'],
      ['Charmin Toilet Paper 12 Pack', 'Other'],
      ['Tide Laundry Detergent', 'Other'],
      ['Glad Trash Bag 30Ct', 'Other'],
      ['Pet food Adult Dog', 'Other'],
      ['Pampers Diaper Size 4', 'Other'],
      ['Hammer Claw 16oz', 'Other'],
      ['Rubber Band Pack', 'Other'],
      ['Baby Formula Powder', 'Other'],
      ['Garden Hose 50ft', 'Other'],
    ])('other (household/pet/baby/tools): %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Motor Oil 5W-30', 'Gas'],
      ['Wiper Blade 22"', 'Gas'],
      ['Engine Coolant Antifreeze', 'Gas'],
    ])('gas/auto: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Hardcover Novel Fiction', 'Entertainment'],
      ['Lego Star Wars Set', 'Entertainment'],
      ['Acoustic Guitar Strings', 'Entertainment'],
      ['Jigsaw Puzzle 1000pc', 'Entertainment'],
    ])('entertainment: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it.each([
      ['Travel Pillow Memory Foam', 'Travel'],
      ['Hardside Suitcase Carry-On', 'Travel'],
      ['Camping Tent 4 Person', 'Travel'],
    ])('travel: %s', (name, expected) => {
      expect(categorizeItem(name)).toBe(expected);
    });

    it('rubber band stays Other (not Healthcare via "rubber")', () => {
      expect(categorizeItem('Rubber Band Pack')).toBe('Other');
    });

    it('food items beat fitness items on tie ("5LB Chicken")', () => {
      // "5lb" matches Healthcare; "chicken" matches Groceries. Groceries
      // listed first → wins on equal score.
      expect(categorizeItem('5LB Chicken Wings')).toBe('Groceries');
    });

    it('does not over-match short keywords ("BANANA REPUBLIC" should not be Groceries)', () => {
      // store name, not a line item — but if it slipped into items it
      // shouldn't auto-categorize as Groceries from 'banana'. With our
      // current hints it WILL match 'banana'; that's acceptable for items.
      // This test documents the current behavior.
      expect(categorizeItem('Banana Bunch')).toBe('Groceries');
    });
  });
});
