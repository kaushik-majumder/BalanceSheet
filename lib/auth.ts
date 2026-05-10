import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

let googleConfigured = false;

export function configureGoogleSignIn(webClientId: string) {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId, offlineAccess: false });
  googleConfigured = true;
}

export type AuthUser = FirebaseAuthTypes.User;
export type ConfirmationResult = FirebaseAuthTypes.ConfirmationResult;

export function onAuthStateChanged(cb: (user: AuthUser | null) => void) {
  return auth().onAuthStateChanged(cb);
}

export function getCurrentUser(): AuthUser | null {
  return auth().currentUser;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const cred = await auth().signInWithEmailAndPassword(email.trim(), password);
  return cred.user;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
  // Best-effort send the verification email. We swallow errors here so a
  // transient send failure doesn't block account creation — the verify-email
  // screen has a Resend button for manual retry.
  try {
    await cred.user.sendEmailVerification();
  } catch {
    // ignore
  }
  return cred.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await auth().sendPasswordResetEmail(email.trim());
}

export async function signInWithPhone(phoneNumber: string): Promise<ConfirmationResult> {
  return auth().signInWithPhoneNumber(phoneNumber.trim());
}

export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<AuthUser> {
  const cred = await confirmation.confirm(code.trim());
  if (!cred?.user) throw new Error('Phone confirmation failed.');
  return cred.user;
}

export async function signInWithGoogle(): Promise<AuthUser> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      const cancelled: Error & { code: string } = Object.assign(new Error('Sign-in cancelled'), {
        code: 'SIGN_IN_CANCELLED',
      });
      throw cancelled;
    }
    throw e;
  }
  if (!isSuccessResponse(response)) {
    const cancelled: Error & { code: string } = Object.assign(new Error('Sign-in cancelled'), {
      code: 'SIGN_IN_CANCELLED',
    });
    throw cancelled;
  }
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('No Google ID token returned.');
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const cred = await auth().signInWithCredential(credential);
  return cred.user;
}

export async function sendVerificationEmail(): Promise<void> {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in.');
  await u.sendEmailVerification();
}

export async function reloadCurrentUser(): Promise<AuthUser | null> {
  const u = auth().currentUser;
  if (!u) return null;
  await u.reload();
  return auth().currentUser;
}

export type AuthProvider = 'password' | 'phone' | 'google.com' | 'other';

export function getPrimaryProvider(user: AuthUser | null): AuthProvider {
  if (!user) return 'other';
  for (const p of user.providerData) {
    if (p.providerId === 'password') return 'password';
    if (p.providerId === 'phone') return 'phone';
    if (p.providerId === 'google.com') return 'google.com';
  }
  return 'other';
}

export function requiresProfileForProvider(provider: AuthProvider): boolean {
  return provider === 'password' || provider === 'phone';
}

export async function deleteCurrentAccount(): Promise<void> {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in.');
  // Best-effort sign out from Google before deleting Firebase account so
  // the next sign-in starts truly fresh.
  try {
    if (await GoogleSignin.getCurrentUser()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // ignore
  }
  await u.delete();
}

export async function signOutEverywhere(): Promise<void> {
  try {
    if (await GoogleSignin.getCurrentUser()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // ignore — Google sign-out is best-effort
  }
  await auth().signOut();
}

export { statusCodes as GoogleStatusCodes };
