import { Receipt } from '../types';
import {
  getCloudMigrationDone,
  setCloudMigrationDone,
} from './secureStorage';
// setReceiptPhotoUrl is imported lazily inside syncReceiptToCloud to
// avoid a circular dependency at module load: database.ts imports
// from cloudSync, and we only need this writeback path from within
// the post-upload code that runs after database.ts is already loaded.

/**
 * Cloud sync layer (Phase 2). Shadows the local SQLite layer with a
 * Firestore write so each receipt also lives in the cloud. Local
 * SQLite stays the authoritative source for reads — Firestore is a
 * durable backup today and the foundation for cross-device family
 * sharing in Phase 3.
 *
 * Defensive loading
 * -----------------
 * @react-native-firebase/firestore and @react-native-firebase/storage
 * are native modules. The current APK (and any OTA-only deploys to
 * older APKs) won't have them linked, so every call site has to
 * gracefully no-op if the modules aren't present. We mirror the
 * pattern used in lib/haptics.ts and lib/pdfExport.ts: probe-load on
 * first use, cache the result, and fail closed (just don't sync).
 *
 * The cloud features become live for a user the FIRST time they
 * launch an APK that includes the native deps. Before that they
 * still get a working app — just no cloud backup.
 *
 * Data model (Firestore)
 * ----------------------
 *   users/{uid}                      profile-ish doc, points to a household
 *   households/{hid}                 owner + member-count metadata
 *   households/{hid}/members/{uid}   role + joinedAt for each member
 *   households/{hid}/receipts/{rid}  full receipt payload
 *
 * On first sign-in we ensure users/{uid} exists. If it doesn't, we
 * create a brand-new solo household and stamp uid as the only
 * member. From then on `householdId` is the partition key for every
 * cloud read/write.
 */

type FirestoreModule = typeof import('@react-native-firebase/firestore').default;
type StorageModule = typeof import('@react-native-firebase/storage').default;

let cachedFirestore: FirestoreModule | null | undefined;
let cachedStorage: StorageModule | null | undefined;

function loadFirestore(): FirestoreModule | null {
  if (cachedFirestore !== undefined) return cachedFirestore as FirestoreModule | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const mod = require('@react-native-firebase/firestore').default;
    cachedFirestore = typeof mod === 'function' ? mod : null;
  } catch {
    cachedFirestore = null;
  }
  return cachedFirestore as FirestoreModule | null;
}

function loadStorage(): StorageModule | null {
  if (cachedStorage !== undefined) return cachedStorage as StorageModule | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const mod = require('@react-native-firebase/storage').default;
    cachedStorage = typeof mod === 'function' ? mod : null;
  } catch {
    cachedStorage = null;
  }
  return cachedStorage as StorageModule | null;
}

export function isCloudSyncAvailable(): boolean {
  return loadFirestore() != null;
}

// ─── diagnostics (visible in Settings) ────────────────────────────────────
//
// Phase 2 cloud sync runs entirely in the background — local writes always
// succeed regardless of whether the cloud half landed. That's the right
// default for resilience but it makes debugging an empty Firestore very
// hard ("did it try? did it fail? did it never fire?"). Track every
// important step in a module-level snapshot the UI can render.

export type CloudSyncDiagnostics = {
  moduleAvailable: boolean;
  storageAvailable: boolean;
  householdId: string | null;
  lastBootstrap: { ok: boolean; at: string; message?: string } | null;
  lastReceiptSync: { ok: boolean; at: string; message?: string; receiptId?: string } | null;
  lastMigration: { migrated: number; failed: number; skipped: boolean; at: string } | null;
};

let diagnostics: CloudSyncDiagnostics = {
  moduleAvailable: false,
  storageAvailable: false,
  householdId: null,
  lastBootstrap: null,
  lastReceiptSync: null,
  lastMigration: null,
};

const listeners = new Set<() => void>();

export function getCloudSyncDiagnostics(): CloudSyncDiagnostics {
  // Recompute the module-availability flags on read so the panel reflects
  // the current state even if a downstream consumer triggered the load
  // path elsewhere.
  return {
    ...diagnostics,
    moduleAvailable: loadFirestore() != null,
    storageAvailable: loadStorage() != null,
  };
}

export function subscribeCloudSyncDiagnostics(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function patchDiagnostics(p: Partial<CloudSyncDiagnostics>): void {
  diagnostics = { ...diagnostics, ...p };
  for (const fn of listeners) fn();
}

// ─── household bootstrap ───────────────────────────────────────────────────

/**
 * Make sure the signed-in user has a Firestore profile doc + a
 * household. Called on every auth state change after sign-in.
 * Idempotent: returns the existing householdId if one is already set,
 * otherwise creates a fresh single-member household.
 *
 * The household id is also cached on `users/{uid}.householdId` so
 * subsequent calls are a single read.
 */
export async function ensureHouseholdForUser(args: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<string | null> {
  const firestore = loadFirestore();
  if (!firestore) {
    patchDiagnostics({
      lastBootstrap: {
        ok: false,
        at: new Date().toISOString(),
        message:
          '@react-native-firebase/firestore native module not loaded. Reinstall a Phase-2 APK or rebuild.',
      },
    });
    return null;
  }
  try {
    const db = firestore();
    const userRef = db.collection('users').doc(args.uid);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data()?.householdId) {
      const existingHid = userSnap.data()!.householdId as string;
      patchDiagnostics({
        householdId: existingHid,
        lastBootstrap: {
          ok: true,
          at: new Date().toISOString(),
          message: 'existing household',
        },
      });
      return existingHid;
    }

    // Create a fresh solo household. Doc id is auto-generated so
    // collisions are impossible across users / re-runs.
    const hidRef = db.collection('households').doc();
    const hid = hidRef.id;
    const now = firestore.FieldValue.serverTimestamp();

    // Two batched writes — the user and the household. The members
    // subcollection is intentionally NOT written here: its security
    // rule looks up the parent household via get(), which returns
    // nothing during a batched create (rules see pre-batch state),
    // so the batch would fail with permission-denied on the members
    // doc. The `memberUids` array on the household doc is what every
    // real-life rule checks against; the members subcollection is
    // future Phase-3 territory for richer per-member metadata
    // (joinedAt, role transitions, etc.). When we add it then, we'll
    // write each members/{uid} doc AFTER the household already
    // exists, where the get() succeeds.
    const batch = db.batch();
    batch.set(userRef, {
      householdId: hid,
      email: args.email ?? null,
      displayName: args.displayName ?? null,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(hidRef, {
      ownerUid: args.uid,
      memberUids: [args.uid],
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    await batch.commit();
    patchDiagnostics({
      householdId: hid,
      lastBootstrap: {
        ok: true,
        at: new Date().toISOString(),
        message: 'new household created',
      },
    });
    return hid;
  } catch (e) {
    // Firestore not enabled in the console yet, network down, or
    // permissions denied. Cloud features just silently no-op until
    // the next attempt — local data is unaffected.
    patchDiagnostics({
      lastBootstrap: {
        ok: false,
        at: new Date().toISOString(),
        message: (e as Error)?.message ?? 'unknown',
      },
    });
    return null;
  }
}

// ─── receipt shadow-write ─────────────────────────────────────────────────

/**
 * Mirror a receipt into Firestore. Fire-and-forget from the caller's
 * perspective — local SQLite is already the source of truth, this is
 * just durability + the data side of eventual family sharing.
 *
 * Errors are swallowed so a transient cloud failure never blocks the
 * local UX. We log to console at debug level so a developer can spot
 * sync issues during testing.
 */
export async function syncReceiptToCloud(
  receipt: Receipt,
  householdId: string,
): Promise<void> {
  const firestore = loadFirestore();
  if (!firestore || !householdId) {
    patchDiagnostics({
      lastReceiptSync: {
        ok: false,
        at: new Date().toISOString(),
        receiptId: receipt.id,
        message: !firestore ? 'firestore module not loaded' : 'no household id set',
      },
    });
    return;
  }
  try {
    // If the receipt has a local image and no cloud URL yet, push the
    // photo to Cloud Storage first so the Firestore doc lands with
    // photoUrl populated in a single write. uploadReceiptPhoto is
    // defensive — it returns null when Storage isn't available,
    // which leaves photoUrl unset (other devices won't see the
    // image, but the rest of the receipt syncs fine).
    let photoUrl: string | null = receipt.photoUrl ?? null;
    if (!photoUrl && receipt.imageUri) {
      photoUrl = await uploadReceiptPhoto({
        localUri: receipt.imageUri,
        householdId,
        receiptId: receipt.id,
      });
      // Persist back so the next save on this receipt skips re-upload.
      if (photoUrl) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
          const { setReceiptPhotoUrl } = require('./database') as {
            setReceiptPhotoUrl: (id: string, url: string) => Promise<void>;
          };
          await setReceiptPhotoUrl(receipt.id, photoUrl);
        } catch {
          // The cache writeback is a nice-to-have. If it fails the
          // next sync just re-uploads — bandwidth cost, not a bug.
        }
      }
    }

    const payload = serializeReceipt(
      { ...receipt, photoUrl: photoUrl ?? undefined } as Receipt,
      firestore,
    );
    const db = firestore();
    const ref = db
      .collection('households')
      .doc(householdId)
      .collection('receipts')
      .doc(receipt.id);
    await ref.set(payload);
    patchDiagnostics({
      lastReceiptSync: {
        ok: true,
        at: new Date().toISOString(),
        receiptId: receipt.id,
      },
    });
  } catch (e) {
    // Log but don't throw — the local write already succeeded.
    // eslint-disable-next-line no-console
    console.warn('[cloudSync] syncReceiptToCloud failed:', (e as Error)?.message);
    patchDiagnostics({
      lastReceiptSync: {
        ok: false,
        at: new Date().toISOString(),
        receiptId: receipt.id,
        message: (e as Error)?.message ?? 'unknown',
      },
    });
  }
}

export async function syncReceiptDeletionToCloud(
  receiptId: string,
  householdId: string,
): Promise<void> {
  const firestore = loadFirestore();
  if (!firestore || !householdId) return;
  try {
    const db = firestore();
    await db
      .collection('households')
      .doc(householdId)
      .collection('receipts')
      .doc(receiptId)
      .delete();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[cloudSync] syncReceiptDeletionToCloud failed:',
      (e as Error)?.message,
    );
  }
}

// ─── photo upload ─────────────────────────────────────────────────────────

/**
 * Upload a receipt photo to Cloud Storage so other household members
 * can view it. Returns the download URL on success, or null on
 * failure / when storage isn't available.
 *
 * Storage path: households/{hid}/photos/{receiptId}.jpg — one photo
 * per receipt, keyed by the same id so deletions in Firestore can
 * cascade-delete the storage object by name.
 */
export async function uploadReceiptPhoto(args: {
  localUri: string;
  householdId: string;
  receiptId: string;
}): Promise<string | null> {
  const storage = loadStorage();
  if (!storage || !args.householdId || !args.localUri) return null;
  try {
    const path = `households/${args.householdId}/photos/${args.receiptId}.jpg`;
    const ref = storage().ref(path);
    await ref.putFile(args.localUri);
    return await ref.getDownloadURL();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[cloudSync] uploadReceiptPhoto failed:', (e as Error)?.message);
    return null;
  }
}

// ─── one-shot backfill of pre-existing local data ─────────────────────────

/**
 * The FIRST time this user launches the cloud-aware build, walk every
 * local receipt and upload it to Firestore. After a successful run
 * (or partial — see fail-counter below) we set a per-user marker in
 * SecureStore so this never repeats.
 *
 * Called by AuthContext immediately after ensureHouseholdForUser
 * resolves with a non-null hid. Safe to call on every sign-in; the
 * marker check short-circuits all but the first run per user.
 *
 * Receipts are accepted as an injected lazy loader so this module
 * doesn't take a hard import on lib/database.ts (which already
 * imports cloudSync — that would be a circular dep).
 */
export async function migrateLocalReceiptsToCloud(args: {
  uid: string;
  householdId: string;
  loadAllReceipts: () => Promise<Receipt[]>;
}): Promise<{ migrated: number; failed: number; skipped: boolean }> {
  const firestore = loadFirestore();
  if (!firestore || !args.householdId) {
    return { migrated: 0, failed: 0, skipped: true };
  }
  const already = await getCloudMigrationDone(args.uid).catch(() => false);
  if (already) return { migrated: 0, failed: 0, skipped: true };

  let migrated = 0;
  let failed = 0;
  try {
    const all = await args.loadAllReceipts();
    const db = firestore();
    const col = db
      .collection('households')
      .doc(args.householdId)
      .collection('receipts');

    // Firestore tops out at 500 ops per batch; we chunk at 400 to
    // leave headroom for the household-doc updates we might add
    // later, and to keep any single network blip from killing the
    // entire migration.
    const CHUNK = 400;
    for (let i = 0; i < all.length; i += CHUNK) {
      const chunk = all.slice(i, i + CHUNK);
      const batch = db.batch();
      for (const r of chunk) {
        batch.set(col.doc(r.id), serializeReceipt(r, firestore));
      }
      try {
        await batch.commit();
        migrated += chunk.length;
      } catch {
        // Fall back to individual writes so one bad doc doesn't sink
        // the whole chunk.
        for (const r of chunk) {
          try {
            await col.doc(r.id).set(serializeReceipt(r, firestore));
            migrated++;
          } catch {
            failed++;
          }
        }
      }
    }
    // Only mark done when the migration completed without any
    // failures — a partial run will retry on the next launch, which
    // is idempotent because we use set() with deterministic doc ids.
    if (failed === 0) await setCloudMigrationDone(args.uid);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[cloudSync] migrateLocalReceiptsToCloud failed:', (e as Error)?.message);
  }
  patchDiagnostics({
    lastMigration: {
      migrated,
      failed,
      skipped: false,
      at: new Date().toISOString(),
    },
  });
  return { migrated, failed, skipped: false };
}

// ─── helpers ──────────────────────────────────────────────────────────────

function serializeReceipt(
  r: Receipt,
  firestore: FirestoreModule,
): Record<string, unknown> {
  // Firestore stores everything as plain JSON-able values. Coerce
  // dates to strings (the rest of the app uses ISO strings already)
  // and replace timestamps with server-side ones where helpful.
  return {
    id: r.id,
    storeName: r.storeName,
    date: r.date,
    totalAmount: r.totalAmount,
    subtotalAmount: r.subtotalAmount ?? null,
    taxAmount: r.taxAmount ?? null,
    category: r.category,
    categoryTags: r.categoryTags ?? [r.category],
    rawText: r.rawText ?? null,
    imageUri: r.imageUri ?? null,
    photoUrl: (r as Receipt & { photoUrl?: string | null }).photoUrl ?? null,
    notes: r.notes ?? null,
    lineItems: (r.lineItems ?? []).map((it) => ({
      id: it.id,
      name: it.name,
      amount: it.amount,
      category: it.category ?? null,
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncedAt: firestore.FieldValue.serverTimestamp(),
  };
}
