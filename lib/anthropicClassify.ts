import { Category } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
// Claude Haiku 4.5 — fastest and cheapest model in the Claude 4.x family,
// well-suited to the "classify a short product name" task.
const MODEL = 'claude-haiku-4-5-20251001';

export type ClassifyAnthropicResult =
  | { ok: true; category: Category }
  | { ok: false; error: string };

/**
 * Classify a single item name by calling the Anthropic API directly from
 * the device. The key is read from expo-secure-store at call time so it
 * never leaves the device, never lands in the JS bundle, and can be
 * rotated by the user from Settings without a rebuild.
 *
 * The prompt is crafted to make Haiku reply with just one category name,
 * matching ALL_CATEGORIES exactly. Anything else is mapped to Other.
 */
export async function classifyWithAnthropic(
  itemName: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ClassifyAnthropicResult> {
  if (!apiKey || !itemName.trim()) {
    return { ok: false, error: 'missing key or name' };
  }

  const prompt =
    `You categorize a shopping receipt line item into ONE of these ` +
    `categories: ${ALL_CATEGORIES.join(', ')}. Reply with ONLY the category ` +
    `name, nothing else.\n\n` +
    `Examples:\n` +
    `Item: "ORGANIC MILK 2%" → Groceries\n` +
    `Item: "iPhone Charging Cable" → Electronics\n` +
    `Item: "10LB Neoprene Dumbbell" → Healthcare\n` +
    `Item: "Lysol All Purpose Cleaner" → Other\n` +
    `Item: "Tylenol Extra Strength" → Pharmacy\n` +
    `Item: "Levi 501 Jeans" → Clothing\n\n` +
    `Item: "${itemName.trim().slice(0, 200)}" →`;

  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error)?.message ?? 'unknown'}` };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    return { ok: false, error: `http ${resp.status}: ${body.slice(0, 200)}` };
  }

  let data: { content?: Array<{ type: string; text: string }> };
  try {
    data = await resp.json();
  } catch (e) {
    return { ok: false, error: `parse: ${(e as Error)?.message ?? 'unknown'}` };
  }

  const reply = data.content?.[0]?.text ?? '';
  const category = pickCategory(reply);
  return { ok: true, category };
}

/**
 * Pull a category from the model's reply. Tries an exact word-boundary
 * match against each known category, falls back to 'Other'.
 */
export function pickCategory(reply: string): Category {
  const trimmed = reply.replace(/[^A-Za-z]+/g, ' ').trim();
  for (const c of ALL_CATEGORIES) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(trimmed)) return c;
  }
  return 'Other';
}
