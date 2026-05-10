import * as SQLite from 'expo-sqlite';
import { Receipt, LineItem } from '../types';

const db = SQLite.openDatabaseSync('receipts.db');

export async function initDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS receipts (
      id              TEXT PRIMARY KEY,
      store_name      TEXT NOT NULL,
      date            TEXT NOT NULL,
      total_amount    REAL NOT NULL DEFAULT 0,
      subtotal_amount REAL,
      tax_amount      REAL,
      category        TEXT NOT NULL DEFAULT 'Other',
      raw_text        TEXT,
      image_uri       TEXT,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id          TEXT PRIMARY KEY,
      receipt_id  TEXT NOT NULL,
      name        TEXT NOT NULL,
      amount      REAL NOT NULL,
      category    TEXT,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_date     ON receipts(date);
    CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
    CREATE INDEX IF NOT EXISTS idx_lineitems_receipt ON line_items(receipt_id);

    CREATE TABLE IF NOT EXISTS profiles (
      uid         TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      gender      TEXT NOT NULL,
      age         INTEGER NOT NULL,
      photo_uri   TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);

  // Migrations for columns added after initial release. ALTER TABLE has no
  // IF NOT EXISTS, so each ADD COLUMN is wrapped to swallow duplicate-column
  // errors on already-migrated databases.
  for (const sql of [
    `ALTER TABLE profiles    ADD COLUMN photo_uri        TEXT`,
    `ALTER TABLE receipts    ADD COLUMN subtotal_amount  REAL`,
    `ALTER TABLE receipts    ADD COLUMN tax_amount       REAL`,
    `ALTER TABLE receipts    ADD COLUMN category_tags    TEXT`,
    `ALTER TABLE line_items  ADD COLUMN category         TEXT`,
  ]) {
    try {
      await db.execAsync(sql);
    } catch {
      // column already exists
    }
  }

  // Cache for the async classifier — keyed by the cleaned, lowercased item
  // name. Lets us avoid re-querying the backend for repeat items.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS item_classifications (
      cleaned_name TEXT PRIMARY KEY,
      category     TEXT NOT NULL,
      source       TEXT NOT NULL,  -- 'local' or 'remote'
      created_at   TEXT NOT NULL
    );
  `);
}

export async function getCachedItemClassification(
  cleanedName: string,
): Promise<{ category: string; source: string } | null> {
  const row = await db.getFirstAsync<{ category: string; source: string }>(
    `SELECT category, source FROM item_classifications WHERE cleaned_name=?`,
    [cleanedName],
  );
  return row ?? null;
}

export async function setCachedItemClassification(
  cleanedName: string,
  category: string,
  source: 'local' | 'remote',
): Promise<void> {
  await db.runAsync(
    `INSERT INTO item_classifications (cleaned_name, category, source, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(cleaned_name) DO UPDATE SET
       category   = excluded.category,
       source     = excluded.source,
       created_at = excluded.created_at`,
    [cleanedName, category, source, new Date().toISOString()],
  );
}

export async function updateLineItemCategory(
  itemId: string,
  category: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE line_items SET category=? WHERE id=?`,
    [category, itemId],
  );
}

export async function deleteAllReceipts(): Promise<void> {
  await db.execAsync(`DELETE FROM line_items; DELETE FROM receipts;`);
}

export interface ProfileRow {
  uid: string;
  first_name: string;
  last_name: string;
  gender: string;
  age: number;
  photo_uri: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfileRow(uid: string): Promise<ProfileRow | null> {
  return (
    (await db.getFirstAsync<ProfileRow>(`SELECT * FROM profiles WHERE uid=?`, [uid])) ?? null
  );
}

export async function upsertProfileRow(row: ProfileRow): Promise<void> {
  await db.runAsync(
    `INSERT INTO profiles (uid, first_name, last_name, gender, age, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET
       first_name = excluded.first_name,
       last_name  = excluded.last_name,
       gender     = excluded.gender,
       age        = excluded.age,
       photo_uri  = excluded.photo_uri,
       updated_at = excluded.updated_at`,
    [
      row.uid,
      row.first_name,
      row.last_name,
      row.gender,
      row.age,
      row.photo_uri,
      row.created_at,
      row.updated_at,
    ],
  );
}

export async function deleteProfileRow(uid: string): Promise<void> {
  await db.runAsync(`DELETE FROM profiles WHERE uid=?`, [uid]);
}

export async function saveReceipt(receipt: Receipt): Promise<void> {
  const tagsJson = serializeTags(receipt.categoryTags);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO receipts
         (id, store_name, date, total_amount, subtotal_amount, tax_amount,
          category, category_tags, raw_text, image_uri, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receipt.id,
        receipt.storeName,
        receipt.date,
        receipt.totalAmount,
        receipt.subtotalAmount ?? null,
        receipt.taxAmount ?? null,
        receipt.category,
        tagsJson,
        receipt.rawText ?? null,
        receipt.imageUri ?? null,
        receipt.notes ?? null,
        receipt.createdAt,
        receipt.updatedAt,
      ],
    );

    for (const item of receipt.lineItems ?? []) {
      await db.runAsync(
        `INSERT INTO line_items (id, receipt_id, name, amount, category) VALUES (?, ?, ?, ?, ?)`,
        [item.id, receipt.id, item.name, item.amount, item.category ?? null],
      );
    }
  });
}

export async function updateReceipt(receipt: Receipt): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE receipts
       SET store_name=?, date=?, total_amount=?, subtotal_amount=?, tax_amount=?,
           category=?, category_tags=?, notes=?, updated_at=?
       WHERE id=?`,
      [
        receipt.storeName,
        receipt.date,
        receipt.totalAmount,
        receipt.subtotalAmount ?? null,
        receipt.taxAmount ?? null,
        receipt.category,
        serializeTags(receipt.categoryTags),
        receipt.notes ?? null,
        new Date().toISOString(),
        receipt.id,
      ],
    );

    // Replace line items if the caller provided a new list. Caller can
    // omit `lineItems` to leave them unchanged (the previous behavior
    // that the dashboard relied on for non-item edits).
    if (receipt.lineItems !== undefined) {
      await db.runAsync(`DELETE FROM line_items WHERE receipt_id=?`, [receipt.id]);
      for (const item of receipt.lineItems) {
        await db.runAsync(
          `INSERT INTO line_items (id, receipt_id, name, amount, category) VALUES (?, ?, ?, ?, ?)`,
          [item.id, receipt.id, item.name, item.amount, item.category ?? null],
        );
      }
    }
  });
}

function serializeTags(tags: string[] | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  return JSON.stringify(tags);
}

function parseTags(raw: string | null, fallbackCategory: string): string[] {
  if (!raw) return [fallbackCategory];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
      return parsed.length ? parsed : [fallbackCategory];
    }
  } catch {
    // fall through
  }
  return [fallbackCategory];
}

export async function deleteReceipt(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM receipts WHERE id=?`, [id]);
}

export async function getAllReceipts(): Promise<Receipt[]> {
  const rows = await db.getAllAsync<RawRow>(`SELECT * FROM receipts ORDER BY date DESC`);
  return await attachLineItems(rows);
}

export async function getReceiptById(id: string): Promise<Receipt | null> {
  const row = await db.getFirstAsync<RawRow>(`SELECT * FROM receipts WHERE id=?`, [id]);
  if (!row) return null;
  const [withItems] = await attachLineItems([row]);
  return withItems ?? rowToReceipt(row);
}

export async function getReceiptsByMonth(year: number, month: number): Promise<Receipt[]> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end   = new Date(year, month, 0, 23, 59, 59).toISOString();
  const rows  = await db.getAllAsync<RawRow>(
    `SELECT * FROM receipts WHERE date >= ? AND date <= ? ORDER BY date DESC`,
    [start, end],
  );
  return await attachLineItems(rows);
}

export async function searchReceipts(query: string): Promise<Receipt[]> {
  const q = `%${query.toLowerCase()}%`;
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM receipts
     WHERE lower(store_name) LIKE ? OR lower(category) LIKE ? OR lower(notes) LIKE ?
     ORDER BY date DESC`,
    [q, q, q],
  );
  return await attachLineItems(rows);
}

/**
 * Batch-load line items for a list of receipt rows in a single query and
 * attach them to the resulting Receipt objects. Used by every receipt-list
 * query so the dashboard's per-category aggregation has the items it needs.
 */
async function attachLineItems(rows: RawRow[]): Promise<Receipt[]> {
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => '?').join(',');
  const itemRows = await db.getAllAsync<{
    id: string;
    receipt_id: string;
    name: string;
    amount: number;
    category: string | null;
  }>(
    `SELECT id, receipt_id, name, amount, category
     FROM line_items WHERE receipt_id IN (${placeholders})`,
    rows.map((r) => r.id),
  );
  const byReceiptId = new Map<string, Receipt['lineItems']>();
  for (const r of itemRows) {
    const list = byReceiptId.get(r.receipt_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      amount: r.amount,
      category: (r.category ?? undefined) as Receipt['category'] | undefined,
    });
    byReceiptId.set(r.receipt_id, list);
  }
  return rows.map((row) => ({
    ...rowToReceipt(row),
    lineItems: byReceiptId.get(row.id) ?? [],
  }));
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface RawRow {
  id: string;
  store_name: string;
  date: string;
  total_amount: number;
  subtotal_amount: number | null;
  tax_amount: number | null;
  category: string;
  category_tags: string | null;
  raw_text: string | null;
  image_uri: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToReceipt(row: RawRow): Receipt {
  return {
    id: row.id,
    storeName: row.store_name,
    date: row.date,
    totalAmount: row.total_amount,
    subtotalAmount: row.subtotal_amount ?? undefined,
    taxAmount: row.tax_amount ?? undefined,
    category: row.category as Receipt['category'],
    categoryTags: parseTags(row.category_tags, row.category),
    rawText: row.raw_text ?? undefined,
    imageUri: row.image_uri ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
