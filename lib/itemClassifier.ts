import Constants from 'expo-constants';
import { Category, LineItem } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';
import { categorizeItem, cleanItemName } from './categorizer';
import {
  getCachedItemClassification,
  setCachedItemClassification,
  updateLineItemCategory,
} from './database';

/**
 * Classify a single item by name. Layered approach:
 *
 *   1. SQLite cache hit → return immediately.
 *   2. Local keyword match (synchronous, ~700 hints) → if it lands on
 *      anything other than 'Other', cache as 'local' and return.
 *   3. If a backend URL is configured (`extra.classifyEndpoint` in
 *      app.config.js) and item is still 'Other' → POST to backend, parse
 *      `{ category }` response, cache as 'remote' and return.
 *   4. Otherwise return 'Other' from the local pass.
 *
 * The backend is opt-in: without `classifyEndpoint`, this function just
 * returns the local result. See `scripts/classify-worker.ts` for a sample
 * Cloudflare Worker implementation that proxies to the Anthropic API.
 */
export async function classifyItemAsync(name: string): Promise<Category> {
  const cleaned = cleanItemName(name).toLowerCase();
  if (!cleaned) return 'Other';

  const cached = await getCachedItemClassification(cleaned);
  if (cached && isValidCategory(cached.category)) {
    return cached.category as Category;
  }

  const local = categorizeItem(name);
  if (local !== 'Other') {
    await setCachedItemClassification(cleaned, local, 'local');
    return local;
  }

  const endpoint =
    (Constants.expoConfig?.extra as { classifyEndpoint?: string } | undefined)
      ?.classifyEndpoint ?? process.env.EXPO_PUBLIC_CLASSIFY_ENDPOINT;
  if (!endpoint) return 'Other';

  try {
    const remote = await fetchRemoteClassification(endpoint, cleaned);
    if (remote && isValidCategory(remote)) {
      await setCachedItemClassification(cleaned, remote, 'remote');
      return remote;
    }
  } catch {
    // Network / parse failure — fall back to Other so the user still gets
    // a usable receipt; we'll re-try next time the item appears.
  }
  return 'Other';
}

/**
 * Walk the line items of a receipt and re-categorize anything currently
 * marked 'Other' (or undefined) using `classifyItemAsync`. Persists category
 * updates back to the line_items table. Safe to call repeatedly — items
 * that already have a non-Other category are skipped.
 *
 * Returns the updated array.
 */
export async function refineUncategorizedItems(items: LineItem[]): Promise<LineItem[]> {
  const out: LineItem[] = [];
  for (const item of items) {
    if (item.category && item.category !== 'Other') {
      out.push(item);
      continue;
    }
    const refined = await classifyItemAsync(item.name);
    if (refined !== item.category) {
      await updateLineItemCategory(item.id, refined);
      out.push({ ...item, category: refined });
    } else {
      out.push(item);
    }
  }
  return out;
}

function isValidCategory(s: string): s is Category {
  return (ALL_CATEGORIES as readonly string[]).includes(s);
}

async function fetchRemoteClassification(
  endpoint: string,
  cleanedName: string,
): Promise<Category | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanedName,
        categories: ALL_CATEGORIES,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { category?: string };
    return data?.category && isValidCategory(data.category) ? data.category : null;
  } finally {
    clearTimeout(timeout);
  }
}
