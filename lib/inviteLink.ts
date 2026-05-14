import * as SecureStore from 'expo-secure-store';

/**
 * Email-link (magic-link) invite flow for Phase 3. Wraps Firebase
 * Auth's `sendSignInLinkToEmail` + `signInWithEmailLink` so the
 * invitee gets a real email with a tap-to-open link.
 *
 * Two pieces:
 *  - sendInviteEmailLink: the inviter calls this. We compose an
 *    ActionCodeSettings pointing at our Firebase Hosting domain,
 *    Firebase sends the email, our Firestore invites doc is written
 *    in parallel (so the recipient's app-side accept check still
 *    finds something even if the email is bounced).
 *  - completeEmailLinkSignIn: invitee taps the email link → app
 *    receives it via Linking → we read the URL, recover the email
 *    (from SecureStore or by prompting), and sign in.
 *
 * Defensive loading
 * -----------------
 * @react-native-firebase/auth IS in the current APK so we can import
 * it normally — but firestore is required lazily by the existing
 * cloudSync helpers, so we mirror that here for symmetry.
 */

const INVITE_HOSTING_DOMAIN = 'balancesheet-android.web.app';
const INVITE_LANDING_PATH = '/invite';
const PENDING_INVITE_EMAIL_KEY = 'bs.invite.pendingEmail';

type AuthModule = typeof import('@react-native-firebase/auth').default;

let cachedAuth: AuthModule | null | undefined;
function loadAuth(): AuthModule | null {
  if (cachedAuth !== undefined) return cachedAuth as AuthModule | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const mod = require('@react-native-firebase/auth').default;
    cachedAuth = typeof mod === 'function' ? mod : null;
  } catch {
    cachedAuth = null;
  }
  return cachedAuth as AuthModule | null;
}

/**
 * Build the ActionCodeSettings that Firebase uses to compose + send
 * the invite email. The `url` is what the recipient lands on after
 * tapping; with `handleCodeInApp: true` Firebase opens the app
 * directly via the universal link / app link configured in
 * app.config.js. If the app isn't installed, Firebase's landing page
 * sends the user to the App Store / Play Store with the right
 * package id pre-filled.
 */
function buildActionCodeSettings(): {
  url: string;
  handleCodeInApp: boolean;
  iOS: { bundleId: string };
  android: { packageName: string; installApp: boolean };
} {
  return {
    url: `https://${INVITE_HOSTING_DOMAIN}${INVITE_LANDING_PATH}`,
    handleCodeInApp: true,
    iOS: { bundleId: 'com.kaushikmajumder.receiptscanner' },
    android: {
      packageName: 'com.kaushikmajumder.receiptscanner',
      installApp: true,
    },
  };
}

/**
 * Trigger Firebase's email send. The caller (lib/cloudSync's
 * inviteUserToHousehold) has already written the invites/{email}
 * doc; this is the user-facing notification layer.
 *
 * Returns a discriminated result so the UI can show the right
 * feedback. Errors are wrapped, not thrown — every meaningful
 * failure (auth not enabled, quota exceeded, invalid email) is
 * mapped to a readable reason.
 */
export async function sendInviteEmailLink(
  email: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const authMod = loadAuth();
  if (!authMod) return { ok: false, reason: 'auth module not loaded' };
  try {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      return { ok: false, reason: 'invalid email' };
    }
    await authMod().sendSignInLinkToEmail(trimmed, buildActionCodeSettings());
    return { ok: true };
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    // Firebase returns very long error messages with the internal
    // domain prefix. Strip the prefix so the alert is readable.
    return { ok: false, reason: msg.replace(/^\[.+?]\s*/, '') };
  }
}

/**
 * Stash the email the inviter just sent to under a key the inviter's
 * device can re-use IF they happen to be the one tapping the link.
 * The intended recipient (different device, possibly a different
 * user) won't have this stored — they'll be prompted to enter their
 * email in completeEmailLinkSignIn.
 */
export async function rememberPendingInviteEmail(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      PENDING_INVITE_EMAIL_KEY,
      email.trim().toLowerCase(),
    );
  } catch {
    // Storage failure is non-fatal — we'll fall back to prompting.
  }
}

export async function getPendingInviteEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PENDING_INVITE_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInviteEmail(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_INVITE_EMAIL_KEY);
  } catch {
    // ignore
  }
}

/**
 * Inspect a URL the app received via Linking and decide whether it's
 * an email sign-in link from Firebase Auth. Used by AuthContext to
 * branch on incoming URLs without trying to call into Firebase for
 * every random deep link.
 */
export function isFirebaseEmailLink(url: string | null): boolean {
  const authMod = loadAuth();
  if (!authMod || !url) return false;
  try {
    return authMod().isSignInWithEmailLink(url);
  } catch {
    return false;
  }
}

/**
 * Finalise the email-link sign-in. `email` is the address that
 * received the link — either recovered from SecureStore (if this is
 * the same device that initiated the invite) or supplied by the
 * user via a prompt. `url` is the link Firebase delivered.
 *
 * On success the Firebase Auth state listener fires automatically
 * with the signed-in user, kicking off AuthContext's normal
 * household-bootstrap + pending-invite check.
 */
export async function completeEmailLinkSignIn(
  email: string,
  url: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const authMod = loadAuth();
  if (!authMod) return { ok: false, reason: 'auth module not loaded' };
  try {
    await authMod().signInWithEmailLink(email.trim(), url);
    await clearPendingInviteEmail();
    return { ok: true };
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    return { ok: false, reason: msg.replace(/^\[.+?]\s*/, '') };
  }
}
