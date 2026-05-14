import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Household-invite email flow. The user-facing email is sent via
 * EmailJS (free tier, no Blaze plan needed) from a connected Gmail
 * account. The template + sender address live in the EmailJS
 * dashboard; this module just POSTs the substitution variables.
 *
 * The recipient's tap on the link in the email opens the app via
 * the existing app-link config (https://balancesheet-android.web.app
 * /invite). The existing invites/{email} doc + getPendingInviteFor-
 * Email flow handles the actual accept at sign-in.
 *
 * Legacy helpers (isFirebaseEmailLink, completeEmailLinkSignIn) are
 * kept below because AuthContext still routes incoming URLs through
 * them; they're inert now that no Firebase magic-link emails are
 * being sent, and can be removed once that wiring is cleaned up.
 */

const INVITE_HOSTING_DOMAIN = 'balancesheet-android.web.app';
const INVITE_LANDING_PATH = '/invite';
const PENDING_INVITE_EMAIL_KEY = 'bs.invite.pendingEmail';
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

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

function readEmailjsConfig(): {
  serviceId: string;
  templateId: string;
  publicKey: string;
} | null {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    (Constants.manifest as { extra?: Record<string, unknown> } | undefined)
      ?.extra;
  const serviceId = (extra?.emailjsServiceId as string | undefined) ?? '';
  const templateId = (extra?.emailjsTemplateId as string | undefined) ?? '';
  const publicKey = (extra?.emailjsPublicKey as string | undefined) ?? '';
  if (!serviceId || !templateId || !publicKey) return null;
  return { serviceId, templateId, publicKey };
}

/**
 * Send the templated invite email via EmailJS. The template (with
 * {{inviter_name}}, {{accept_link}}, {{to_email}} placeholders) and
 * the FROM address (your Gmail) are configured on the EmailJS
 * dashboard — this function just POSTs the substitution vars.
 *
 * Returns a discriminated result so the UI can show the right
 * feedback. The Firestore invites/{email} doc is the source of truth
 * for the accept flow, written by the caller BEFORE this — so an
 * email-send failure here is recoverable (the recipient can still
 * sign in with that email and pick up the pending invite).
 */
export async function sendInviteEmailLink(
  email: string,
  inviter?: { name?: string | null; email?: string | null },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cfg = readEmailjsConfig();
  if (!cfg) {
    return { ok: false, reason: 'EmailJS credentials not configured' };
  }
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, reason: 'invalid email' };
  }
  const inviterName =
    inviter?.name?.trim() ||
    inviter?.email?.trim() ||
    'A Receipt Scanner user';
  const acceptLink = `https://${INVITE_HOSTING_DOMAIN}${INVITE_LANDING_PATH}?email=${encodeURIComponent(trimmed.toLowerCase())}`;
  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: trimmed,
          inviter_name: inviterName,
          inviter_email: inviter?.email ?? '',
          accept_link: acceptLink,
          subject: `${inviterName} invited you to their household on Receipt Scanner`,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        reason: `EmailJS ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message ?? 'unknown' };
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
 * one of OUR invite links (the new templated-email path, not the
 * legacy Firebase magic-link). Returns the invitee email from the
 * `?email=` query param, or null if the URL doesn't match.
 *
 * Format we recognize:
 *   https://balancesheet-android.web.app/invite?email=<encoded>
 */
export function parseInviteAppLink(url: string | null): { email: string } | null {
  if (!url) return null;
  // Plain string parsing — React Native's URL polyfill ships without
  // a working URLSearchParams, so `new URL(url).searchParams.get()`
  // throws or returns null inconsistently across Android versions.
  // Match either the https app-link OR the custom-scheme deep link.
  const httpsPrefix = `https://${INVITE_HOSTING_DOMAIN}${INVITE_LANDING_PATH}`;
  const schemePrefix = `receipt-scanner://${INVITE_LANDING_PATH.replace(/^\//, '')}`;
  let rest: string;
  if (url.startsWith(httpsPrefix)) {
    rest = url.slice(httpsPrefix.length);
  } else if (url.startsWith(schemePrefix)) {
    rest = url.slice(schemePrefix.length);
  } else {
    return null;
  }
  // rest is now whatever follows the path — optional trailing slash,
  // optional ?query, optional #fragment.
  const queryIdx = rest.indexOf('?');
  if (queryIdx < 0) return null;
  const query = rest.slice(queryIdx + 1).split('#')[0];
  // Parse query manually. We only care about `email`.
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const key = pair.slice(0, eq);
    if (key !== 'email') continue;
    const rawValue = pair.slice(eq + 1);
    try {
      const decoded = decodeURIComponent(rawValue.replace(/\+/g, ' '))
        .trim()
        .toLowerCase();
      if (!decoded.includes('@')) return null;
      return { email: decoded };
    } catch {
      return null;
    }
  }
  return null;
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
