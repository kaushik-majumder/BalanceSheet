import Constants from 'expo-constants';
import { Category, LineItem } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';
import { categorizeItem, cleanItemName } from './categorizer';
import {
  getCachedItemClassification,
  setCachedItemClassification,
  updateLineItemCategory,
} from './database';
import {
  getAiClassifyEnabled,
  getAnthropicApiKey,
} from './secureStorage';
import { classifyWithAnthropic } from './anthropicClassify';

/**
 * Classify a single item by name. Layered approach:
 *
 *   1. SQLite cache hit → return immediately.
 *   2. Local keyword match (synchronous, ~700 hints) → if it lands on
 *      anything other than 'Other', cache as 'local' and return.
 *   3. If AI classify is enabled in Settings AND an Anthropic API key is
 *      stored in expo-secure-store → call the Anthropic API directly from
 *      the device (no backend needed).
 *   4. Else if `extra.classifyEndpoint` is configured → POST to that
 *      backend (the original Cloudflare-Worker pattern).
 *   5. Otherwise return 'Other' from the local pass.
 *
 * Both remote layers are opt-in. By default the function returns the
 * local result and never hits the network.
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

  // Step 3: direct Anthropic call (preferred when key is set).
  const aiEnabled = await getAiClassifyEnabled();
  if (aiEnabled) {
    const apiKey = await getAnthropicApiKey();
    if (apiKey) {
      try {
        const result = await classifyWithAnthropic(cleaned, apiKey);
        if (result.ok && isValidCategory(result.category)) {
          await setCachedItemClassification(cleaned, result.category, 'remote');
          return result.category;
        }
      } catch {
        // fall through to backend / Other
      }
    }
  }

  // Step 4: optional backend proxy (Cloudflare Worker etc.)
  const endpoint =
    (Constants.expoConfig?.extra as { classifyEndpoint?: string } | undefined)
      ?.classifyEndpoint ?? process.env.EXPO_PUBLIC_CLASSIFY_ENDPOINT;
  if (endpoint) {
    try {
      const remote = await fetchRemoteClassification(endpoint, cleaned);
      if (remote && isValidCategory(remote)) {
        await setCachedItemClassification(cleaned, remote, 'remote');
        return remote;
      }
    } catch {
      // network / parse failure — fall through to Other
    }
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
