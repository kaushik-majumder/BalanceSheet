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
    return line;
  }
  return 'Unknown Store';
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
  const items: LineItem[] = [];
  // Price at end of line, optionally followed by a trailing single status
  // letter (Walmart 'J'/'D', Costco 'E', etc.).
  const priceRe = /\$?\s*(\d{1,5}\.\d{2})\s*([A-Z])?\s*$/;
  const skipRe = /\b(total|sub-?total|tax|hst|gst|pst|qst|vat|discount|coupon|savings|change|cash|card|visa|mastercard|amex|debit|credit|balance|tip|gratuity|tend(?:er)?|approval|terminal|store\s*#|tr\s*#|op\s*#|te\s*#|st\s*#)\b/i;
  // Items must look like real names — at least one alpha character once
  // numeric noise is stripped.
  const ALPHA_RE = /[a-z]/i;

  for (const line of lines) {
    if (skipRe.test(line)) continue;

    const priceMatch = line.match(priceRe);
    if (!priceMatch) continue;

    const amount = parseFloat(priceMatch[1]);
    if (!(amount > 0 && amount < 10_000)) continue;

    const rawName = line.replace(priceMatch[0], '').replace(/\s+/g, ' ').trim();
    const name = cleanItemName(rawName);
    if (!name || !ALPHA_RE.test(name)) continue;
    if (name.length < 2) continue;

    const category = categorizeItem(name);
    items.push({
      id: Math.random().toString(36).slice(2, 9),
      name,
      amount,
      category,
    });
  }

  return items.slice(0, 50);
}
