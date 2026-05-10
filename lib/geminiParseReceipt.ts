import { Category, LineItem } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';
import { mergeDiscountLines } from './parser';

// Gemini 2.5 Flash with structured-JSON output. Free-tier-friendly and
// dramatically more robust than regex for messy phone-camera OCR.
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type GeminiReceipt = {
  storeName: string;
  date: string; // YYYY-MM-DD or empty
  subtotalAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  lineItems: LineItem[];
  /** Multi-select tags for the receipt as a whole. May include the
   *  standard 10 category names AND custom tags Gemini suggests
   *  (e.g. "Pet Food", "Home Decor"). 1-4 tags typical. */
  categoryTags: string[];
};

/** A reason code we surface to the UI so it can pick the right copy
 *  and decide whether to auto-retry. */
export type GeminiErrorKind =
  | 'no-key'
  | 'network'
  | 'rate-limited'
  | 'auth'
  | 'server'
  | 'parse'
  | 'empty'
  | 'unknown';

export type GeminiParseResult =
  | { ok: true; receipt: GeminiReceipt }
  | { ok: false; kind: GeminiErrorKind; error: string };

const PROMPT = `You are a receipt parser. Extract structured data from the receipt OCR text below.

Rules for ITEMS:
- CRITICAL: pair every item NAME with the price that appears on the SAME receipt row in the original receipt. Do not shift, sort, or rearrange. Read the receipt top to bottom, row by row.
- If the OCR text returns names and prices in two separate vertical blocks (left column then right column), treat them as parallel arrays: name[i] pairs with price[i]. Keep the original order from the receipt.
- The item amounts must SUM to the subtotal (within $0.50 of rounding/tax tolerance). If they don't, you've paired wrong — re-check the order.
- Strip 8-14 digit UPC/SKU codes from item names.
- Strip leading numeric item codes (e.g. "1420528 VEGGIES PK 4" → "VEGGIES PK 4").
- Strip the trailing single-letter tax-status flag (e.g. "H", "J", "D", "E") from item names.
- Negative amounts ARE valid items — they represent discounts/markdowns. Recognize ALL of these forms as negative:
    "$15.00-"   trailing minus (Costco / warehouse chains)
    "-15.00"    leading minus (generic)
    "($52.50)"  parentheses (Skechers / accounting-style)
  Emit them as their own line item with a negative amount, paired with the name on that receipt row (often a TPD/markdown reference like "TPD/1993379", or just "BOGO 50% Off"). Do NOT pre-merge them into the original item — downstream code handles that.
- Many receipts print one product across MULTIPLE OCR rows: the first row has the NAME and PRICE, and the next few rows have METADATA (style code, size, color, promo banner, "New Price" summary). Treat all metadata rows as belonging to the previous item — do NOT emit a separate item for them. Specifically skip:
    "Style: 183004BLK"
    "Size: 8 Color: BLACK"
    "BOGO 50% Off Footwear" (with or without a $0.00 price beside it)
    "New Price: $110.00"      — this is a SUMMARY of the post-discount price, not a separate item
    "You Saved $52.50"        — receipt-level savings summary
    "Items Sold: N", "Items Returned: N"
- When a single product has BOTH an original price AND a discount line nearby (e.g. "$104.99T" then "($52.50)"), emit them as TWO line items (one positive, one negative). The downstream merger pairs them. Do NOT collapse to the "New Price" value yourself.
- Do NOT include these as items, they are markers / payment / header noise:
  - SUBTOTAL, TAX, TOTAL, AMOUNT, BALANCE, CHANGE, TENDER lines
  - Transaction IDs: STORE / ST / OP / TE / TR / TRM / WHSE / INVOICE, Sequence Number, Approval Code, Assoc/Reg/Tran numbers
  - Bank/EMV codes: RRN, AID, TC, AUTH, REFERENCE, APPROVAL, TVR, TSI, IAD, ARC, ACI, ISO, Application Cryptogram/Preferred Name/Label
  - Costco markers: "Bottom of basket", "BOB Count", "Items Sold: N"
  - Loyalty info: "ZV Member", "Member #", "Membership"
  - Masked card numbers (lines with mostly X's, e.g. "XXXXXXXXXXXX0933")
  - Postal codes / phone numbers / store address lines
  - Tax footnotes like "H = HST G = GST"
  - Signature / approval status lines, "Verified by PIN"
- For each item, choose the BEST matching category from the allowed list. Footwear → Clothing, accessories → Clothing, shoe care/polish → Other.

Rules for FIELDS:
- store: the merchant name, cleaned of OCR garbage characters and casing weirdness.
- date: format as YYYY-MM-DD if findable, otherwise empty string.
- subtotal / tax: use null if not present on the receipt. The subtotal is the sum BEFORE tax. The tax is the GST/HST/PST/sales-tax amount. Don't confuse them.
- total: the grand total the customer paid.
- categoryTags: 1 to 4 tags for the WHOLE receipt. Each tag MAY be one of the standard categories (${ALL_CATEGORIES.join(', ')}) OR a more specific custom tag like "Pet Food", "Home Decor", "Office Supplies", "Auto Parts", "Baby Care", "Sports Gear", etc. — whatever fits the receipt content best. Keep tags short (1-3 words). For a receipt that spans multiple types of items, include multiple tags.

Allowed categories for individual line items (use EXACTLY one of these, no custom values for items): ${ALL_CATEGORIES.join(', ')}.

Receipt OCR text:
"""`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    store: { type: 'string' },
    date: { type: 'string' },
    subtotal: { type: 'number', nullable: true },
    tax: { type: 'number', nullable: true },
    total: { type: 'number' },
    categoryTags: {
      type: 'array',
      items: { type: 'string' },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          category: {
            type: 'string',
            enum: ALL_CATEGORIES as unknown as string[],
          },
        },
        required: ['name', 'amount', 'category'],
      },
    },
  },
  required: ['store', 'total', 'items'],
};

/**
 * Send the OCR text to Gemini 2.5 Flash with a structured-JSON response
 * schema. Gemini extracts a clean { store, date, subtotal, tax, total,
 * items } payload that handles two-column receipts, lowercase tax
 * letters, header noise, postal codes, and other quirks the regex
 * parser struggles with.
 */
export async function parseReceiptWithGemini(
  rawText: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<GeminiParseResult> {
  if (!apiKey || !rawText.trim()) {
    return { ok: false, kind: 'no-key', error: 'missing key or text' };
  }

  // Cap input at ~8000 chars (~2k tokens) — even the longest receipts
  // fit, and this prevents pathological OCR from eating up tokens.
  const truncated = rawText.length > 8000 ? rawText.slice(0, 8000) : rawText;
  const prompt = `${PROMPT}\n${truncated}\n"""`;

  let resp: Response;
  try {
    resp = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
          maxOutputTokens: 4096,
        },
      }),
      signal,
    });
  } catch (e) {
    return {
      ok: false,
      kind: 'network',
      error: `network: ${(e as Error)?.message ?? 'unknown'}`,
    };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const kind: GeminiErrorKind =
      resp.status === 429
        ? 'rate-limited'
        : resp.status === 401 || resp.status === 403
          ? 'auth'
          : resp.status >= 500
            ? 'server'
            : 'unknown';
    return {
      ok: false,
      kind,
      error: `http ${resp.status}: ${body.slice(0, 300)}`,
    };
  }

  let envelope: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    envelope = await resp.json();
  } catch (e) {
    return {
      ok: false,
      kind: 'parse',
      error: `parse envelope: ${(e as Error)?.message}`,
    };
  }

  const text = envelope.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, kind: 'empty', error: 'empty response' };
  return parseGeminiPayload(text);
}

/**
 * Validate and convert Gemini's JSON reply into a typed GeminiReceipt.
 * Tolerant of small drift (numeric strings, missing fields, unknown
 * categories — all coerced or fallbacked).
 */
export function parseGeminiPayload(jsonText: string): GeminiParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return {
      ok: false,
      kind: 'parse',
      error: `parse json: ${(e as Error)?.message}`,
    };
  }
  const obj = raw as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') {
    return { ok: false, kind: 'parse', error: 'reply was not an object' };
  }

  const store = typeof obj.store === 'string' ? obj.store.trim() : '';
  const date = typeof obj.date === 'string' ? obj.date.trim() : '';
  const total = toFiniteNumber(obj.total);
  const subtotal = toFiniteNumber(obj.subtotal);
  const tax = toFiniteNumber(obj.tax);

  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  const items: LineItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== 'object') continue;
    const i = it as Record<string, unknown>;
    const name = typeof i.name === 'string' ? i.name.trim() : '';
    const amount = toFiniteNumber(i.amount);
    if (!name || amount == null) continue;
    const category = isCategory(i.category) ? (i.category as Category) : 'Other';
    items.push({
      id: Math.random().toString(36).slice(2, 9),
      name,
      amount,
      category,
    });
  }

  // Tag list — accept any short non-empty strings up to 4. If the model
  // omitted them, fall back to the unique categories among the items.
  let tags: string[] = [];
  if (Array.isArray(obj.categoryTags)) {
    for (const t of obj.categoryTags) {
      if (typeof t !== 'string') continue;
      const trimmed = t.trim();
      if (!trimmed || trimmed.length > 32) continue;
      if (!tags.includes(trimmed)) tags.push(trimmed);
      if (tags.length >= 6) break;
    }
  }
  if (tags.length === 0) {
    const seen = new Set<string>();
    for (const it of items) if (it.category) seen.add(it.category);
    tags = Array.from(seen);
  }

  // Fold any negative discount / markdown lines into the item they
  // apply to — same merge pass as the regex parser so the rest of the
  // app (dashboard, drilldown) sees a clean one-row-per-product list.
  const mergedItems = mergeDiscountLines(items);

  return {
    ok: true,
    receipt: {
      storeName: store || 'Unknown Store',
      date: isoDateOrEmpty(date),
      subtotalAmount: subtotal ?? undefined,
      taxAmount: tax ?? undefined,
      totalAmount: total ?? 0,
      lineItems: mergedItems,
      categoryTags: tags,
    },
  };
}

function toFiniteNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function isCategory(v: unknown): boolean {
  return typeof v === 'string' && (ALL_CATEGORIES as readonly string[]).includes(v);
}

function isoDateOrEmpty(date: string): string {
  if (!date) return new Date().toISOString();
  // Accept YYYY-MM-DD; tolerate YYYY/MM/DD too. Anything else falls back
  // to "now" rather than producing an invalid Date downstream.
  const m = date.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!m) return new Date().toISOString();
  const iso = `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}
