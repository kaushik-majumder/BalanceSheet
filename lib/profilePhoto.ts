import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const PHOTO_DIR = `${FileSystem.documentDirectory}profile-photos/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/**
 * Open the OS image picker, and on success copy the picked image into our
 * app's document directory under a stable, uid-keyed filename. Returns the
 * persistent file:// URI, or null if the user cancelled.
 *
 * We copy because expo-image-picker hands back a temp/cache URI that the OS
 * may reclaim. Saving to documentDirectory makes it durable.
 */
export async function pickProfilePhoto(uid: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      'Photo library access was denied. Enable it in system settings to add a profile photo.',
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const src = result.assets[0].uri;

  await ensureDir();
  // Use a stable filename per UID; overwrite previous photo.
  const ext = src.split('.').pop()?.toLowerCase() || 'jpg';
  const dest = `${PHOTO_DIR}${uid}.${ext}`;
  // Delete any existing file at the destination so we don't accumulate.
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    // ignore
  }
  await FileSystem.copyAsync({ from: src, to: dest });
  return dest;
}

export async function deleteProfilePhoto(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best effort
  }
}
