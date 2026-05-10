import { Category } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';

// Gemini 2.5 Flash — fast and cheap (free tier 1500 req/day for personal
// use), well-suited to short structured-extraction prompts.
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type ClassifyGeminiResult =
  | { ok: true; category: Category }
  | { ok: false; error: string };

/**
 * Classify a single line-item name by calling the Gemini API directly
 * from the device. Returns one of ALL_CATEGORIES — anything unparseable
 * falls back to 'Other'.
 */
export async function classifyWithGemini(
  itemName: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ClassifyGeminiResult> {
  if (!apiKey || !itemName.trim()) {
    return { ok: false, error: 'missing key or name' };
  }

  const prompt =
    `You categorize a shopping receipt line item into ONE of these categories: ${ALL_CATEGORIES.join(
      ', ',
    )}. Reply with ONLY the category name, nothing else.\n\n` +
    `Examples:\nItem: "ORGANIC MILK 2%" → Groceries\nItem: "iPhone Charging Cable" → Electronics\nItem: "10LB Neoprene Dumbbell" → Healthcare\nItem: "Lysol All Purpose Cleaner" → Other\nItem: "Tylenol Extra Strength" → Pharmacy\nItem: "Levi 501 Jeans" → Clothing\n\n` +
    `Item: "${itemName.trim().slice(0, 200)}" →`;

  let resp: Response;
  try {
    resp = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 16,
          temperature: 0,
        },
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

  let data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    data = await resp.json();
  } catch (e) {
    return { ok: false, error: `parse: ${(e as Error)?.message ?? 'unknown'}` };
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const category = pickCategory(reply);
  return { ok: true, category };
}

/**
 * Match the model's reply against the known category list. Word-boundary
 * regex so a token like "Groceries" wins over substring noise. Falls back
 * to 'Other' if nothing matches.
 */
export function pickCategory(reply: string): Category {
  const trimmed = reply.replace(/[^A-Za-z]+/g, ' ').trim();
  for (const c of ALL_CATEGORIES) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(trimmed)) return c;
  }
  return 'Other';
}
