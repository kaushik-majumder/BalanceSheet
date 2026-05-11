import * as FileSystem from 'expo-file-system';

/**
 * Persistent storage for scanned receipt images. expo-image-picker /
 * expo-camera hand back URIs in the app's cache directory; the OS
 * (especially Android) can prune that cache anywhere from a few
 * minutes to a few days later, leaving the receipt's saved imageUri
 * pointing at a missing file. The edit screen then renders a blank
 * area where the photo used to be.
 *
 * Fix: when saving a new receipt, COPY the captured image into our
 * app's documentDirectory under a stable receipt-id-keyed filename.
 * Save THAT URI in the database instead. documentDirectory survives
 * across cache cleanups and reboots.
 */
const RECEIPT_PHOTO_DIR = `${FileSystem.documentDirectory}receipt-photos/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECEIPT_PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPT_PHOTO_DIR, {
      intermediates: true,
    });
  }
}

/**
 * Copy a captured image URI into the persistent receipt-photos
 * directory and return the new file:// URI. If the source URI is
 * already inside our document directory (e.g. a re-save), return it
 * unchanged. If the copy fails for any reason, fall back to the
 * original URI so we don't lose the image entirely.
 */
export async function persistReceiptImage(
  sourceUri: string | undefined | null,
  receiptId: string,
): Promise<string | undefined> {
  if (!sourceUri) return undefined;
  if (sourceUri.startsWith(RECEIPT_PHOTO_DIR)) return sourceUri;
  if (!sourceUri.startsWith('file://') && !sourceUri.startsWith('/')) {
    // remote URL or content:// — leave alone, the OS resolves it.
    return sourceUri;
  }
  try {
    await ensureDir();
    const ext = sourceUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    // Strip any query-string the OS may have tacked on after the ext.
    const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
    const dest = `${RECEIPT_PHOTO_DIR}${receiptId}.${safeExt}`;
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch {
    // copy failed (file gone, no permission, disk full…) — fall back
    // to the original URI rather than losing the image reference.
    return sourceUri;
  }
}

/** Best-effort delete of a persistent receipt image. */
export async function deleteReceiptImage(
  uri: string | undefined | null,
): Promise<void> {
  if (!uri) return;
  if (!uri.startsWith(RECEIPT_PHOTO_DIR)) return; // only our own files
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best effort
  }
}
