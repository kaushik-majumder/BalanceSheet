import { NativeModules } from 'react-native';
import { Receipt } from '../types';

/**
 * PDF export for the Reports screen.
 *
 * Mirrors the defensive-loading pattern used by lib/haptics.ts — the
 * existing preview APK may not have expo-print linked yet (the OTA
 * ships JS only, not native modules), so we probe NativeModules
 * before requiring the JS shim. If the native module is absent the
 * caller falls back to CSV.
 *
 * Activate by running a fresh APK build (GitHub Actions workflow);
 * until then PDF generation is silently a no-op and the share button
 * gives the user a CSV.
 */

const PRINT_NATIVE_KEYS = ['ExpoPrint', 'ExponentPrint', 'RNPrint'];
const PRINT_AVAILABLE: boolean =
  !!NativeModules &&
  PRINT_NATIVE_KEYS.some((k) => !!(NativeModules as Record<string, unknown>)[k]);

export function isPdfExportAvailable(): boolean {
  return PRINT_AVAILABLE;
}

type PrintModule = {
  printToFileAsync: (opts: {
    html: string;
    width?: number;
    height?: number;
    base64?: boolean;
  }) => Promise<{ uri: string }>;
};

let mod: PrintModule | null | undefined;
function loadPrint(): PrintModule | null {
  if (!PRINT_AVAILABLE) return null;
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const candidate = require('expo-print') as Partial<PrintModule>;
    if (!candidate?.printToFileAsync) {
      mod = null;
    } else {
      mod = candidate as PrintModule;
    }
  } catch {
    mod = null;
  }
  return mod;
}

// ---------- HTML template ----------

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the printable HTML. Keep styles inline + simple so iOS
 * UIPrint and Android PrintManager render it consistently. The
 * layout is one summary card up top, then chronological receipt
 * cards underneath — each receipt block lists its line items.
 */
function buildHtml(args: {
  receipts: Receipt[];
  startLabel: string;
  endLabel: string;
}): string {
  const { receipts, startLabel, endLabel } = args;
  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));

  const totalSpent = sorted.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalReceipts = sorted.length;

  // Per-category aggregate
  const byCategory = new Map<string, number>();
  for (const r of sorted) {
    const tags = (r.categoryTags ?? [r.category]).filter(Boolean);
    const share = (r.totalAmount || 0) / Math.max(tags.length, 1);
    for (const t of tags) {
      byCategory.set(t, (byCategory.get(t) ?? 0) + share);
    }
  }
  const categoryRows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, amt]) => `
        <tr>
          <td>${escapeHtml(cat)}</td>
          <td class="num">${fmtMoney(amt)}</td>
        </tr>`,
    )
    .join('');

  const receiptCards = sorted
    .map((r) => {
      const dateOnly = r.date.slice(0, 10);
      const tags = (r.categoryTags ?? [r.category]).filter(Boolean).join(' · ');
      const lineItemRows = (r.lineItems ?? [])
        .map(
          (it) => `
            <tr>
              <td>${escapeHtml(it.name)}</td>
              <td>${escapeHtml((it.category ?? '') as string)}</td>
              <td class="num">${fmtMoney(it.amount)}</td>
            </tr>`,
        )
        .join('');
      const itemsTable = lineItemRows
        ? `<table class="items">
             <thead><tr><th>Item</th><th>Category</th><th class="num">Amount</th></tr></thead>
             <tbody>${lineItemRows}</tbody>
           </table>`
        : '<p class="muted">No line items captured.</p>';
      const subtotal =
        r.subtotalAmount != null ? `<span>Subtotal ${fmtMoney(r.subtotalAmount)}</span>` : '';
      const tax = r.taxAmount != null ? `<span>Tax ${fmtMoney(r.taxAmount)}</span>` : '';
      const notes = r.notes
        ? `<p class="notes"><strong>Notes:</strong> ${escapeHtml(r.notes)}</p>`
        : '';
      return `
        <section class="receipt">
          <header>
            <h3>${escapeHtml(r.storeName)}</h3>
            <span class="date">${dateOnly}</span>
          </header>
          <p class="tags">${escapeHtml(tags)}</p>
          ${itemsTable}
          <p class="totals">
            ${subtotal}
            ${tax}
            <span><strong>Total ${fmtMoney(r.totalAmount)}</strong></span>
          </p>
          ${notes}
        </section>`;
    })
    .join('');

  // Page break suggestions so long reports paginate sensibly.
  const styles = `
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .range { color: #6b7280; font-size: 12px; margin: 0 0 20px; }
    .summary { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 16px; margin: 0 0 20px; }
    .summary .row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
    .summary .stat { font-size: 13px; color: #047857; }
    .summary .stat strong { display: block; font-size: 20px; color: #064e3b; margin-top: 2px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; margin: 18px 0 6px; }
    table.cats { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; }
    table.cats td { padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
    table.cats td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .receipt { border-top: 1px solid #d1d5db; padding-top: 12px; margin-top: 14px; page-break-inside: avoid; }
    .receipt header { display: flex; justify-content: space-between; align-items: baseline; }
    .receipt h3 { font-size: 15px; margin: 0; }
    .receipt .date { font-size: 11px; color: #6b7280; }
    .receipt .tags { font-size: 11px; color: #6b7280; margin: 2px 0 8px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px; }
    table.items th { text-align: left; font-weight: 600; padding: 4px 6px; border-bottom: 1px solid #e5e7eb; color: #6b7280; }
    table.items td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
    table.items td.num, table.items th.num { text-align: right; font-variant-numeric: tabular-nums; }
    p.totals { display: flex; justify-content: flex-end; gap: 14px; font-size: 12px; color: #374151; margin: 6px 0; }
    p.totals strong { color: #064e3b; }
    p.notes { font-size: 11px; color: #4b5563; margin: 4px 0 0; }
    p.muted { color: #9ca3af; font-style: italic; font-size: 11px; margin: 4px 0; }
  `;

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<title>BalanceSheet Receipts</title>
<style>${styles}</style>
</head><body>
<h1>BalanceSheet — Receipts Export</h1>
<p class="range">${escapeHtml(startLabel)} – ${escapeHtml(endLabel)} · generated ${new Date().toLocaleString()}</p>

<div class="summary">
  <div class="row">
    <span class="stat">Receipts<strong>${totalReceipts}</strong></span>
    <span class="stat">Total spent<strong>${fmtMoney(totalSpent)}</strong></span>
    <span class="stat">Avg / receipt<strong>${fmtMoney(totalReceipts > 0 ? totalSpent / totalReceipts : 0)}</strong></span>
  </div>
</div>

${
  categoryRows
    ? `<h2>Spending by category</h2>
       <table class="cats"><tbody>${categoryRows}</tbody></table>`
    : ''
}

<h2>Receipts</h2>
${receiptCards || '<p class="muted">No receipts in this range.</p>'}

</body></html>`;
}

/**
 * Generate a PDF for the given receipts. Returns the file URI, or
 * `null` if expo-print isn't linked in the running build (caller
 * should fall back to CSV).
 */
export async function generateReceiptsPdf(args: {
  receipts: Receipt[];
  startLabel: string;
  endLabel: string;
}): Promise<string | null> {
  const Print = loadPrint();
  if (!Print) return null;
  const html = buildHtml(args);
  try {
    const { uri } = await Print.printToFileAsync({
      html,
      // US Letter @ 72 DPI; native renderer handles scaling for both
      // iOS UIPrint and Android PrintManager.
      width: 612,
      height: 792,
      base64: false,
    });
    return uri;
  } catch {
    return null;
  }
}
