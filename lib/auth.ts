import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

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
  const userInfo = await GoogleSignin.signIn();
  const idToken = (userInfo as any)?.idToken ?? (userInfo as any)?.data?.idToken;
  if (!idToken) throw new Error('No Google ID token returned.');
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const cred = await auth().signInWithCredential(credential);
  return cred.user;
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
