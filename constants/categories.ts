import { Category } from '../types';

export const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  Groceries: [
    'walmart', 'kroger', 'safeway', 'whole foods', 'trader joe', 'aldi', 'costco',
    'target', 'publix', 'wegmans', 'food lion', 'giant', 'stop & shop', 'meijer',
    'sprouts', 'fresh market', 'grocery', 'supermarket', 'market', 'tesco', 'sainsbury',
    'lidl', 'asda', 'waitrose', 'co-op', 'spar',
    'milk', 'bread', 'eggs', 'produce', 'meat', 'vegetable', 'fruit', 'dairy',
    'chicken', 'beef', 'pork', 'rice', 'pasta', 'cereal', 'snack', 'beverage',
    'organic', 'fresh', 'frozen', 'canned',
  ],
  Electronics: [
    'best buy', 'apple store', 'samsung', 'microsoft store', 'newegg', 'b&h photo',
    'laptop', 'phone', 'iphone', 'tablet', 'ipad', 'computer', 'monitor', 'keyboard',
    'mouse', 'headphone', 'speaker', 'television', 'camera', 'cable', 'charger',
    'battery', 'usb', 'hdmi', 'gaming', 'console', 'playstation', 'xbox', 'nintendo',
    'electronics', 'tech', 'device', 'gadget', 'smartwatch', 'earbuds', 'drone',
    'router', 'modem', 'hard drive', 'ssd', 'ram', 'gpu', 'processor',
  ],
  Dining: [
    'mcdonald', 'starbucks', 'chipotle', 'subway', 'burger king', "wendy's", 'taco bell',
    'pizza hut', 'domino', 'kfc', 'chick-fil-a', 'panera', 'olive garden', "applebee's",
    'restaurant', 'cafe', 'coffee', 'diner', 'bistro', 'grill', 'bar & grill',
    'sushi', 'pizza', 'burger', 'sandwich', 'wings', 'bbq', 'chinese', 'thai', 'mexican',
    'italian', 'indian', 'ramen', 'pho', 'food truck', 'bakery', 'pastry', 'donut',
    'boba', 'smoothie', 'juice bar', 'noodle', 'steakhouse', 'seafood',
  ],
  Pharmacy: [
    'cvs', 'walgreens', 'rite aid', 'duane reade', 'pharmacy', 'drug store', 'drugstore',
    'boots', 'lloyds pharmacy', 'superdrug',
    'medicine', 'prescription', ' rx ', 'vitamin', 'supplement', 'bandage', 'first aid',
    'ibuprofen', 'acetaminophen', 'antibiotic', 'medication', 'health & beauty',
    'toiletries', 'shampoo', 'lotion', 'sunscreen',
  ],
  Gas: [
    'shell', 'bp', 'chevron', 'exxon', 'mobil', 'texaco', 'sunoco', 'marathon',
    'speedway', 'circle k', 'wawa', "love's", 'pilot flying j', 'casey\'s',
    'esso', 'total energies', 'petro-canada',
    'gasoline', 'diesel', 'petrol', 'fuel station', 'gallon', 'pump', 'unleaded',
    'regular gas', 'premium gas', 'fillup',
  ],
  Clothing: [
    'h&m', 'zara', 'gap', 'old navy', 'banana republic', 'j.crew', 'uniqlo', 'forever 21',
    'express', 'american eagle', 'hollister', 'abercrombie', "victoria's secret",
    'nike store', 'adidas', 'under armour', 'nordstrom', "macy's", 'bloomingdale',
    'primark', 'topshop', 'next', 'marks & spencer',
    'shirt', 'pants', 'jeans', 'dress', 'shoes', 'sneakers', 'jacket', 'coat', 'sweater',
    'apparel', 'fashion', 'accessories', 'handbag', 'wallet', 'belt', 'socks', 'underwear',
  ],
  Entertainment: [
    'amc theaters', 'regal cinema', 'cinemark', 'odeon', 'vue cinema',
    'netflix', 'spotify', 'hulu', 'disney+', 'amazon prime',
    'steam', 'playstation store', 'xbox game pass', 'nintendo eshop',
    'concert', 'ticketmaster', 'stubhub', 'eventbrite', 'museum', 'zoo', 'aquarium',
    'bowling', 'arcade', 'escape room', 'laser tag', 'mini golf', 'trampoline park',
    'streaming', 'subscription', 'membership',
  ],
  Travel: [
    'united airlines', 'delta airlines', 'american airlines', 'southwest', 'jetblue', 'spirit',
    'ryanair', 'easyjet', 'british airways', 'emirates',
    'marriott', 'hilton', 'hyatt', 'sheraton', 'holiday inn', 'motel 6', 'best western',
    'airbnb', 'vrbo', 'booking.com', 'expedia',
    'uber', 'lyft', 'taxi', 'car rental', 'hertz', 'enterprise', 'avis', 'budget',
    'airport', 'boarding pass', 'baggage', 'hotel', 'resort', 'cruise',
  ],
  Healthcare: [
    'hospital', 'medical center', 'clinic', 'urgent care', 'emergency room',
    'dental', 'dentist', 'orthodontist', 'vision center', 'optometrist', 'ophthalmologist',
    'lab corp', 'quest diagnostics', 'radiology', 'imaging center',
    'physical therapy', 'chiropractor', 'dermatologist', 'cardiologist',
    'copay', 'deductible', 'insurance', 'specialist', 'surgery', 'procedure',
    // Fitness / wellness products commonly sold at general retailers
    'yoga', 'pilates', 'dumbbell', 'kettlebell', 'barbell', 'neopren', 'rubber dumbbell',
    'weight plate', 'fitness', 'workout', 'exercise',
  ],
  Other: [],
};

/**
 * Tokens that signal an item is for line-item categorization (not store-level).
 * Line-item names from receipts are abbreviated and noisy, so we use shorter,
 * distinctive substrings here. These layer on top of CATEGORY_KEYWORDS at
 * categorize-item time only — they would be too aggressive at the store level.
 */
export const ITEM_CATEGORY_HINTS: Partial<Record<Category, string[]>> = {
  Groceries: [
    'crois', 'croissant', 'choc', 'chocolate', 'cocoa', 'cookie', 'cracker',
    'shrimp', 'salmon', 'tuna', 'tofu', 'sausage', 'ham', 'bacon', 'turkey',
    'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'grape', 'mango',
    'lettuce', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'spinach',
    'cheese', 'yogurt', 'butter', 'cream', 'soda', 'juice', 'water',
    'chip', 'crisps', 'candy', 'gum', 'mint', 'popcorn', 'granola',
    'flour', 'sugar', 'salt', 'pepper', 'oil', 'sauce', 'soup', 'noodle',
  ],
  Healthcare: [
    'yoga', 'pilates', 'dumbbell', 'kettlebell', 'barbell',
    'neopren', '5lb', '10lb', '15lb', '20lb', '25lb',
    'rubber', 'weight', 'mat', 'fitness', 'gym', 'exercise',
    'tape', 'brace', 'first-aid',
  ],
  Pharmacy: [
    'shampoo', 'soap', 'toothpaste', 'toothbrush', 'mouthwash',
    'lotion', 'sunscreen', 'deodorant', 'razor', 'tampon', 'pad ',
    'vitamin', 'supplement', 'tylenol', 'advil', 'aspirin', 'cough', 'cold relief',
  ],
  Electronics: [
    'usb', 'hdmi', 'cable', 'charger', 'battery', 'aaa', 'aa pack',
    'earbud', 'headphone', 'speaker', 'mouse pad',
  ],
  Other: [
    // household — these don't have a dedicated category; we leave them in Other
    'freshmtic', 'air wick', 'freshener', 'cleaner', 'detergent', 'bleach',
    'tissue', 'paper towel', 'napkin', 'foil', 'wrap', 'storage bag',
    'broom', 'mop', 'sponge', 'glove',
  ],
};

export const CATEGORY_ICONS: Record<Category, string> = {
  Groceries: '🛒',
  Electronics: '💻',
  Dining: '🍽️',
  Pharmacy: '💊',
  Gas: '⛽',
  Clothing: '👗',
  Entertainment: '🎬',
  Travel: '✈️',
  Healthcare: '🏥',
  Other: '📦',
};

export const ALL_CATEGORIES: Category[] = [
  'Groceries',
  'Electronics',
  'Dining',
  'Pharmacy',
  'Gas',
  'Clothing',
  'Entertainment',
  'Travel',
  'Healthcare',
  'Other',
];
