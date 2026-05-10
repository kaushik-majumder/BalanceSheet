import { Category, LineItem } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';

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
};

export type GeminiParseResult =
  | { ok: true; receipt: GeminiReceipt }
  | { ok: false; error: string };

const PROMPT = `You are a receipt parser. Extract structured data from the receipt OCR text below.

Rules:
- Strip 8-14 digit UPC/SKU codes from item names.
- Strip the trailing single-letter tax-status flag (e.g. "J", "D", "E") from item names if present.
- Do NOT include the SUBTOTAL, TAX, or TOTAL amounts in the items array.
- Do NOT include transaction IDs (ST/OP/TE/TR), bank reference codes (RRN/AID/TC/AUTH), postal codes, phone numbers, or store header text as items.
- For each item, choose the BEST matching category from the allowed list.
- date: format as YYYY-MM-DD if findable, otherwise empty string.
- subtotal / tax: use null if not present on the receipt.
- store: the merchant name, cleaned of OCR garbage characters.

Allowed categories (use exactly): ${ALL_CATEGORIES.join(', ')}.

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
    return { ok: false, error: 'missing key or text' };
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
    return { ok: false, error: `network: ${(e as Error)?.message ?? 'unknown'}` };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    return { ok: false, error: `http ${resp.status}: ${body.slice(0, 300)}` };
  }

  let envelope: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    envelope = await resp.json();
  } catch (e) {
    return { ok: false, error: `parse envelope: ${(e as Error)?.message}` };
  }

  const text = envelope.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: 'empty response' };
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
    return { ok: false, error: `parse json: ${(e as Error)?.message}` };
  }
  const obj = raw as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'reply was not an object' };
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

  return {
    ok: true,
    receipt: {
      storeName: store || 'Unknown Store',
      date: isoDateOrEmpty(date),
      subtotalAmount: subtotal ?? undefined,
      taxAmount: tax ?? undefined,
      totalAmount: total ?? 0,
      lineItems: items,
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
