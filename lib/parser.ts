import { ParsedReceipt, LineItem } from '../types';
import { categorizeItem, cleanItemName, detectCategory } from './categorizer';

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  const storeName = extractStoreName(lines);
  const date = extractDate(rawText);
  const totalAmount = extractTotalAmount(rawText, lines);
  const taxAmount = extractTaxAmount(rawText);
  const subtotalAmount = extractSubtotalAmount(rawText);
  const category = detectCategory(storeName, rawText);
  const lineItems = extractLineItems(lines);

  return {
    storeName,
    date,
    totalAmount,
    subtotalAmount,
    taxAmount,
    category,
    lineItems,
    rawText,
  };
}

function extractStoreName(lines: string[]): string {
  const skipPatterns = [
    /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/,                          // phone number
    /^\d+\s+\w+.*(st|ave|blvd|rd|dr|ln|way|ct|street|avenue)$/i, // address
    /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/,                             // date
    /^(thank you|welcome|receipt|invoice|order|transaction)/i,
    /^(how did we|complete our|please complete|tell us)/i,        // survey prompts
    /^(www\.|http)/i,
    /^[\d\s\-#]+$/,                                               // only numbers
  ];

  for (const line of lines.slice(0, 6)) {
    if (line.length < 3) continue;
    if (skipPatterns.some((p) => p.test(line))) continue;
    return cleanStoreName(line);
  }
  return 'Unknown Store';
}

/**
 * OCR sometimes appends stray punctuation or garbage characters to a store
 * name (e.g. "Walmart >%"). Strip non-alphanumeric trailing characters and
 * collapse whitespace, but preserve common store-name punctuation like
 * apostrophes, ampersands, and periods inside the name.
 */
function cleanStoreName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9 &'.()-]+$/g, '')   // trailing garbage
    .replace(/^[^a-zA-Z]+/, '')                // leading garbage
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown Store';
}

function extractDate(text: string): string {
  // Ordered by specificity — try most specific formats first
  const matchers: Array<(t: string) => Date | null> = [
    // YYYY-MM-DD
    (t) => {
      const m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
      return m ? new Date(`${m[1]}-${m[2]}-${m[3]}`) : null;
    },
    // MM/DD/YYYY or MM-DD-YYYY
    (t) => {
      const m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
      return m ? new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`) : null;
    },
    // Month DD, YYYY  e.g. "May 8, 2026"
    (t) => {
      const m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
      return m ? new Date(`${m[1]} ${m[2]} ${m[3]}`) : null;
    },
    // DD Month YYYY  e.g. "8 May 2026"
    (t) => {
      const m = t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i);
      return m ? new Date(`${m[2]} ${m[1]} ${m[3]}`) : null;
    },
    // MM/DD/YY
    (t) => {
      const m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/);
      return m ? new Date(`20${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`) : null;
    },
  ];

  const now = new Date();
  for (const matcher of matchers) {
    const d = matcher(text);
    if (d && !isNaN(d.getTime()) && d.getFullYear() >= 2000 && d <= now) {
      return d.toISOString();
    }
  }

  return now.toISOString();
}

function extractTotalAmount(text: string, lines: string[]): number {
  // Priority 1: explicit total keyword on same line.
  // Word boundary on "total" so "subtotal" is NOT matched as the grand total.
  const inlinePatterns = [
    /(?:grand\s+total|total\s+due|amount\s+due|you\s+paid|sale\s+total|total\s+amount|balance\s+due)[\s:$]*(\d[\d,]*\.\d{2})/i,
    /(?:^|[^a-z])total[\s:$]+(\d[\d,]*\.\d{2})/im,
    /(?:^|\s)amount[\s:$]+(\d[\d,]*\.\d{2})/im,
    /(?:^|\s)balance[\s:$]+(\d[\d,]*\.\d{2})/im,
  ];

  for (const pattern of inlinePatterns) {
    const m = text.match(pattern);
    if (m) {
      const v = parseFloat(m[1].replace(',', ''));
      if (v > 0 && v < 100_000) return v;
    }
  }

  // Priority 2: keyword line followed by price on next line
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\b(total|amount|balance)\b/i.test(lines[i]) && !/sub/i.test(lines[i])) {
      const m = `${lines[i]} ${lines[i + 1]}`.match(/\$?\s*(\d[\d,]*\.\d{2})/);
      if (m) {
        const v = parseFloat(m[1].replace(',', ''));
        if (v > 0 && v < 100_000) return v;
      }
    }
  }

  // Priority 3: largest explicit $ amount
  const dollarAmounts: number[] = [];
  const dollarRe = /\$\s*(\d[\d,]*\.\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = dollarRe.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(',', ''));
    if (v > 0 && v < 100_000) dollarAmounts.push(v);
  }
  if (dollarAmounts.length) return Math.max(...dollarAmounts);

  // Priority 4: largest bare decimal that looks like a price
  const bareAmounts: number[] = [];
  const bareRe = /\b(\d{1,5}\.\d{2})\b/g;
  while ((m = bareRe.exec(text)) !== null) {
    const v = parseFloat(m[1]);
    if (v > 0 && v < 100_000) bareAmounts.push(v);
  }
  if (bareAmounts.length) return Math.max(...bareAmounts);

  return 0;
}

function extractTaxAmount(text: string): number | undefined {
  // Try: TAX, HST, GST, PST, QST, VAT, SALES TAX. Some receipts list a rate
  // before the amount (e.g. "HST 13.0000 % $13.56") — anchor on the keyword
  // and pick the LAST amount on the same logical match, allowing optional
  // percentage in between.
  const patterns = [
    // "HST 13.0000 %  $13.56" or "HST 13% $13.56"
    /\b(hst|gst|pst|qst|vat|sales\s+tax|tax)\b[^\d$]*(?:\d[\d.]*\s*%[^\d$]*)?\$?\s*(\d[\d,]*\.\d{2})/i,
  ];
  let best: number | undefined;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = parseFloat(m[2].replace(',', ''));
      if (v > 0 && v < 100_000) {
        // Prefer the largest matched tax amount (covers receipts that show
        // both HST and a separate GST/PST line).
        best = best === undefined ? v : Math.max(best, v);
      }
    }
  }
  // Greedy second pass for receipts with multiple tax lines.
  const greedy = /\b(hst|gst|pst|qst|vat|sales\s+tax|tax)\b[^\d$]*(?:\d[\d.]*\s*%[^\d$]*)?\$?\s*(\d[\d,]*\.\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = greedy.exec(text)) !== null) {
    const v = parseFloat(m[2].replace(',', ''));
    if (v > 0 && v < 100_000) {
      best = best === undefined ? v : Math.max(best, v);
    }
  }
  return best;
}

function extractSubtotalAmount(text: string): number | undefined {
  const m = text.match(/\bsub[\s-]?total\b[\s:$]*(\d[\d,]*\.\d{2})/i);
  if (m) {
    const v = parseFloat(m[1].replace(',', ''));
    if (v > 0 && v < 100_000) return v;
  }
  return undefined;
}

function extractLineItems(lines: string[]): LineItem[] {
  // Price at end of line, optionally followed by a trailing single status
  // letter (Walmart 'J'/'D', Costco 'E', etc.).
  const priceAtEndRe = /\$?\s*(\d{1,5}\.\d{2})\s*([A-Z])?\s*$/;
  // A line that is JUST a price (with optional status letter) — used in
  // two-column receipts where OCR reads names and prices separately.
  const priceOnlyRe = /^\s*\$?\s*(\d{1,5}\.\d{2})\s*([A-Z])?\s*$/;
  // Pure UPC line (only digits, 8-14 long).
  const upcOnlyRe = /^\s*\d{8,14}\s*$/;
  const skipRe = /\b(total|sub-?total|tax|hst|gst|pst|qst|vat|discount|coupon|savings|change|cash|card|visa|mastercard|amex|debit|credit|balance|tip|gratuity|tend(?:er)?|approval|terminal|store\s*#|tr\s*#|op\s*#|te\s*#|st\s*#)\b/i;
  const ALPHA_RE = /[a-z]/i;

  // Run both extractors and pick the one that recovered more items.
  //   - Inline path matches "name + price on the same line" (most receipts)
  //   - Paired path handles two-column OCR where names and prices come
  //     out in separate vertical blocks (common when ML Kit splits a
  //     two-column receipt by column instead of by row)
  // Picking the larger result means a clean inline receipt isn't penalised,
  // and a two-column receipt where inline finds 0 falls back gracefully.
  const inline = extractInlineItems(lines, priceAtEndRe, skipRe, ALPHA_RE);
  const paired = extractPairedItems(lines, {
    priceOnlyRe,
    upcOnlyRe,
    skipRe,
    alphaRe: ALPHA_RE,
    priceAtEndRe,
  });
  return (paired.length > inline.length ? paired : inline).slice(0, 50);
}

function extractInlineItems(
  lines: string[],
  priceRe: RegExp,
  skipRe: RegExp,
  alphaRe: RegExp,
): LineItem[] {
  const items: LineItem[] = [];
  for (const line of lines) {
    if (skipRe.test(line)) continue;
    const priceMatch = line.match(priceRe);
    if (!priceMatch) continue;
    const amount = parseFloat(priceMatch[1]);
    if (!(amount > 0 && amount < 10_000)) continue;
    const rawName = line.replace(priceMatch[0], '').replace(/\s+/g, ' ').trim();
    const name = cleanItemName(rawName);
    if (!name || !alphaRe.test(name)) continue;
    if (name.length < 2) continue;
    items.push({
      id: Math.random().toString(36).slice(2, 9),
      name,
      amount,
      category: categorizeItem(name),
    });
  }
  return items;
}

/**
 * Two-column-receipt fallback. ML Kit's text recognition often splits a
 * two-column receipt (item-name column on the left, price column on the
 * right) into two separate top-to-bottom blocks: first all the names,
 * then all the prices. Pair them up by position.
 *
 * Heuristic:
 *   - Walk the lines once and bucket each line as 'name' (has alpha,
 *     no price), 'priceOnly' (just a price), 'inline' (name+price), or
 *     'noise' (skip).
 *   - For 'inline' lines we already have items.
 *   - For the rest, pair the i-th 'name' with the i-th 'priceOnly' line
 *     that comes AFTER all the names. If the counts mismatch, pair as
 *     many as we can.
 */
function extractPairedItems(
  lines: string[],
  re: {
    priceOnlyRe: RegExp;
    upcOnlyRe: RegExp;
    skipRe: RegExp;
    alphaRe: RegExp;
    priceAtEndRe: RegExp;
  },
): LineItem[] {
  const items: LineItem[] = [];
  const pendingNames: string[] = [];
  const pendingPrices: Array<{ amount: number }> = [];

  // The items block on a typical receipt sits between the header (store,
  // address, transaction IDs) and the totals (SUBTOTAL, TAX, TOTAL).
  // Start buffering only once we see the first line that looks like a
  // receipt item — heuristic: a UPC code embedded somewhere, OR a
  // weight/quantity prefix like "10LB", "1 OZ", "5KG", "12PK".
  const itemShapeRe =
    /\b\d{8,14}\b|^\s*\d+\s*(lb|oz|kg|g|ml|l|pk|pck|ct|count|pack)\b/i;
  let inItemsBlock = false;

  for (const line of lines) {
    if (re.skipRe.test(line)) {
      // Headers like "ST# 03001" hit skipRe before we enter the items
      // block — just skip them. After we're in the items block, a hit
      // means we've reached the totals/footer; stop here so we don't
      // pair stray prices with header noise.
      if (inItemsBlock) break;
      continue;
    }
    if (!inItemsBlock) {
      if (!itemShapeRe.test(line)) continue;
      inItemsBlock = true;
    }
    if (re.upcOnlyRe.test(line)) continue;

    // Inline match — emit immediately and don't buffer.
    const inline = line.match(re.priceAtEndRe);
    if (inline) {
      const amount = parseFloat(inline[1]);
      if (!(amount > 0 && amount < 10_000)) continue;
      const rawName = line.replace(inline[0], '').replace(/\s+/g, ' ').trim();
      const name = cleanItemName(rawName);
      if (name && re.alphaRe.test(name) && name.length >= 2) {
        items.push({
          id: Math.random().toString(36).slice(2, 9),
          name,
          amount,
          category: categorizeItem(name),
        });
      } else if (name === '' || !re.alphaRe.test(name)) {
        // The line was JUST a price (no name on the same line) — buffer it.
        pendingPrices.push({ amount });
      }
      continue;
    }

    // Price-only line.
    const priceOnly = line.match(re.priceOnlyRe);
    if (priceOnly) {
      const amount = parseFloat(priceOnly[1]);
      if (amount > 0 && amount < 10_000) pendingPrices.push({ amount });
      continue;
    }

    // Name-ish line (has at least one letter).
    const name = cleanItemName(line);
    if (name && re.alphaRe.test(name) && name.length >= 2) {
      pendingNames.push(name);
    }
  }

  // Pair name[i] with price[i].
  const pairCount = Math.min(pendingNames.length, pendingPrices.length);
  for (let i = 0; i < pairCount; i++) {
    items.push({
      id: Math.random().toString(36).slice(2, 9),
      name: pendingNames[i],
      amount: pendingPrices[i].amount,
      category: categorizeItem(pendingNames[i]),
    });
  }

  return items;
}
