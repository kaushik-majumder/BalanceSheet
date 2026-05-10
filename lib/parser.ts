import { ParsedReceipt, LineItem } from '../types';
import { categorizeItem, cleanItemName, detectCategory } from './categorizer';

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  const storeName = extractStoreName(lines);
  const date = extractDate(rawText);
  let totalAmount = extractTotalAmount(rawText, lines);
  let taxAmount = extractTaxAmount(rawText);
  let subtotalAmount = extractSubtotalAmount(rawText);
  const category = detectCategory(storeName, rawText);

  // Amounts that look like prices but are really receipt-level totals.
  // Exclude them when pairing line items so the subtotal/tax/total don't
  // get attached to the last few items. Only exclude the grand total
  // when we have CORROBORATING evidence (a Subtotal or Tax line was also
  // extracted) — the total amount comes from a "largest dollar amount"
  // fallback when no TOTAL keyword is present, which often equals the
  // single most expensive item price.
  const excluded = new Set<number>();
  if (subtotalAmount != null) excluded.add(round2(subtotalAmount));
  if (taxAmount != null) excluded.add(round2(taxAmount));
  if (totalAmount > 0 && (subtotalAmount != null || taxAmount != null)) {
    excluded.add(round2(totalAmount));
  }
  const { items: lineItems, leftoverPrices } = extractLineItemsWithLeftovers(
    lines,
    excluded,
  );

  // Two-column receipts often put the SUBTOTAL/HST/TOTAL labels on
  // separate lines from their amounts, so the same-line regex returns
  // undefined. The paired-parser leaves the totals-block prices in
  // `leftoverPrices`; recover the values by sorting and matching the
  // arithmetic identity tax + subtotal = total.
  if (leftoverPrices.length >= 2) {
    const sorted = [...leftoverPrices].sort((a, b) => a - b);
    if (sorted.length >= 3) {
      // Find a triple where small + middle ≈ large.
      for (let i = 0; i < sorted.length - 2; i++) {
        for (let j = i + 1; j < sorted.length - 1; j++) {
          for (let k = j + 1; k < sorted.length; k++) {
            if (Math.abs(sorted[i] + sorted[j] - sorted[k]) < 0.02) {
              if (taxAmount == null) taxAmount = sorted[i];
              if (subtotalAmount == null) subtotalAmount = sorted[j];
              if (!(totalAmount > 0)) totalAmount = sorted[k];
              i = sorted.length;
              j = sorted.length;
              break;
            }
          }
        }
      }
    } else if (sorted.length === 2) {
      // Subtotal + total layout (no separate tax line).
      if (subtotalAmount == null) subtotalAmount = sorted[0];
      if (!(totalAmount > 0)) totalAmount = sorted[1];
    }
  }

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
  // Priority 1: explicit total keyword on same line. Word boundary on
  // "total" so "subtotal" is NOT matched as the grand total. Same-line
  // only ([ \t:$]+ instead of [\s:$]+) so a "TOTAL" label in a two-column
  // receipt isn't spliced with a price several lines later.
  const inlinePatterns = [
    /(?:grand\s+total|total\s+due|amount\s+due|you\s+paid|sale\s+total|total\s+amount|balance\s+due)[ \t:$]*(\d[\d,]*\.\d{2})(?!\d)/i,
    /(?:^|[^a-z])total[ \t:$]+(\d[\d,]*\.\d{2})(?!\d)/im,
    /(?:^|[ \t])amount[ \t:$]+(\d[\d,]*\.\d{2})(?!\d)/im,
    /(?:^|[ \t])balance[ \t:$]+(\d[\d,]*\.\d{2})(?!\d)/im,
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
  // Constrain to single-line matching ([^\n\d$]* and [ \t]* — no \n in
  // any of the gaps) so we don't splice a tax label on one line with a
  // price several lines later. (?!\d) prevents matching "13.00" out of
  // the rate string "13.0000". Two-column layouts where the tax amount
  // is far from the label fall back to leftover-prices inference in
  // parseReceiptText.
  const greedy =
    /\b(hst|gst|pst|qst|vat|sales\s+tax|tax)\b[^\n\d$]*(?:\d[\d.]*[ \t]*%[^\n\d$]*)?\$?[ \t]*(\d[\d,]*\.\d{2})(?!\d)/gi;
  let best: number | undefined;
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
  // Same-line only — see extractTaxAmount.
  const m = text.match(/\bsub[\s-]?total\b[ \t:$]*(\d[\d,]*\.\d{2})(?!\d)/i);
  if (m) {
    const v = parseFloat(m[1].replace(',', ''));
    if (v > 0 && v < 100_000) return v;
  }
  return undefined;
}

/**
 * Lines that are NEVER receipt items:
 *   - Totals / taxes / payment keywords
 *   - Transaction-id rows (STORE/ST/OP/TE/TR/RRN/AID/TC with 3+ digits)
 *   - Postal codes (Canadian "L1Z 1G1" or US "12345" / "12345-6789" on own line)
 * The '#' after the prefix is optional because OCR sometimes drops it.
 */
const SKIP_LINE_RE = new RegExp(
  [
    '\\b(total|sub-?total|tax|hst|gst|pst|qst|vat|discount|coupon|savings|change|cash|card|visa|mastercard|amex|debit|credit|balance|tip|gratuity|tend(?:er)?|approval|terminal)\\b',
    '\\b(?:store|st|op|te|tr|rrn|aid|tc|auth(?:orization)?)\\s*#?\\s*\\d{3,}',
    '^\\s*[A-Z]\\d[A-Z]\\s+\\d[A-Z]\\d\\s*$',
    '^\\s*\\d{5}(?:-\\d{4})?\\s*$',
  ].join('|'),
  'i',
);
const PRICE_AT_END_RE = /\$?\s*(\d{1,5}\.\d{2})\s*([A-Z])?\s*$/;
const PRICE_ONLY_RE = /^\s*\$?\s*(\d{1,5}\.\d{2})\s*([A-Z])?\s*$/;
const UPC_ONLY_RE = /^\s*\d{8,14}\s*$/;
const ALPHA_RE = /[a-z]/i;

/**
 * Returns line items plus the leftover prices (paired extractor's unused
 * price buffer). parseReceiptText uses the leftovers to recover
 * subtotal/tax/total values when the same-line regex paths can't find them.
 *
 * Internally runs two extractors and picks whichever recovered more items:
 *   - Inline: matches "NAME … PRICE" on the same line (most receipts)
 *   - Paired: handles two-column OCR where names and prices come out as
 *     two separate vertical blocks (common when ML Kit splits a
 *     two-column receipt by column instead of by row)
 */
function extractLineItemsWithLeftovers(
  lines: string[],
  excludedAmounts: Set<number> = new Set(),
): { items: LineItem[]; leftoverPrices: number[] } {
  const inline = extractInlineItems(lines, PRICE_AT_END_RE, SKIP_LINE_RE, ALPHA_RE);
  const paired = extractPairedItems(lines, {
    priceOnlyRe: PRICE_ONLY_RE,
    upcOnlyRe: UPC_ONLY_RE,
    skipRe: SKIP_LINE_RE,
    alphaRe: ALPHA_RE,
    priceAtEndRe: PRICE_AT_END_RE,
    excludedAmounts,
  });
  if (paired.items.length > inline.length) {
    return {
      items: paired.items.slice(0, 50),
      leftoverPrices: paired.leftoverPrices,
    };
  }
  return { items: inline.slice(0, 50), leftoverPrices: [] };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
    excludedAmounts: Set<number>;
  },
): { items: LineItem[]; leftoverPrices: number[] } {
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
      // Always skip total/tax/subtotal/transaction-id/payment lines —
      // never use them as either names or prices. Don't BREAK though:
      // ML Kit two-column OCR sometimes interleaves the labels block
      // (SUBTOTAL/HST/TOTAL on the left) BEFORE the prices block (the
      // entire right column on the right). Breaking too early discards
      // every line-item price.
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
      } else if (
        (name === '' || !re.alphaRe.test(name)) &&
        !re.excludedAmounts.has(round2(amount))
      ) {
        // The line was JUST a price (no name on the same line) — buffer
        // it, unless it equals the receipt's subtotal/tax/total amount,
        // in which case it's a totals-block price, not a per-item price.
        pendingPrices.push({ amount });
      }
      continue;
    }

    // Price-only line.
    const priceOnly = line.match(re.priceOnlyRe);
    if (priceOnly) {
      const amount = parseFloat(priceOnly[1]);
      if (
        amount > 0 &&
        amount < 10_000 &&
        !re.excludedAmounts.has(round2(amount))
      ) {
        pendingPrices.push({ amount });
      }
      continue;
    }

    // Name-ish line (has at least one letter).
    const name = cleanItemName(line);
    if (name && re.alphaRe.test(name) && name.length >= 2) {
      pendingNames.push(name);
    }
  }

  // Pair name[i] with price[i]. Any prices left over are likely the
  // totals block (subtotal / tax / total amounts).
  const pairCount = Math.min(pendingNames.length, pendingPrices.length);
  for (let i = 0; i < pairCount; i++) {
    items.push({
      id: Math.random().toString(36).slice(2, 9),
      name: pendingNames[i],
      amount: pendingPrices[i].amount,
      category: categorizeItem(pendingNames[i]),
    });
  }
  const leftoverPrices = pendingPrices.slice(pairCount).map((p) => p.amount);

  return { items, leftoverPrices };
}
