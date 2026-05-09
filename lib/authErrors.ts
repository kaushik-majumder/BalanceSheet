export function humanizeAuthError(e: unknown): string {
  const code: string | undefined = (e as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/invalid-phone-number':
      return 'That phone number looks invalid. Include country code.';
    case 'auth/invalid-verification-code':
      return 'That code was incorrect. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return (e as { message?: string })?.message ?? 'Something went wrong. Please try again.';
  }
}
