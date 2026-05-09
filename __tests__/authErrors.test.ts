import { humanizeAuthError } from '../lib/authErrors';

describe('humanizeAuthError', () => {
  it('handles invalid email', () => {
    expect(humanizeAuthError({ code: 'auth/invalid-email' })).toBe(
      'That email address looks invalid.',
    );
  });

  it('collapses wrong-password / user-not-found / invalid-credential to one message (no user enumeration)', () => {
    const msg = 'Incorrect email or password.';
    expect(humanizeAuthError({ code: 'auth/wrong-password' })).toBe(msg);
    expect(humanizeAuthError({ code: 'auth/user-not-found' })).toBe(msg);
    expect(humanizeAuthError({ code: 'auth/invalid-credential' })).toBe(msg);
  });

  it('handles email already in use', () => {
    expect(humanizeAuthError({ code: 'auth/email-already-in-use' })).toBe(
      'An account with that email already exists.',
    );
  });

  it('handles weak password', () => {
    expect(humanizeAuthError({ code: 'auth/weak-password' })).toBe(
      'Password is too weak. Use at least 8 characters.',
    );
  });

  it('handles rate limiting', () => {
    expect(humanizeAuthError({ code: 'auth/too-many-requests' })).toBe(
      'Too many attempts. Try again in a few minutes.',
    );
  });

  it('handles invalid phone number', () => {
    expect(humanizeAuthError({ code: 'auth/invalid-phone-number' })).toBe(
      'That phone number looks invalid. Include country code.',
    );
  });

  it('handles invalid OTP code', () => {
    expect(humanizeAuthError({ code: 'auth/invalid-verification-code' })).toBe(
      'That code was incorrect. Please try again.',
    );
  });

  it('handles network failure', () => {
    expect(humanizeAuthError({ code: 'auth/network-request-failed' })).toBe(
      'Network error. Check your connection and try again.',
    );
  });

  it('falls back to the error message when code is unknown', () => {
    expect(humanizeAuthError({ code: 'auth/unknown', message: 'Custom thing happened' })).toBe(
      'Custom thing happened',
    );
  });

  it('falls back to a generic message when there is no code or message', () => {
    expect(humanizeAuthError({})).toBe('Something went wrong. Please try again.');
    expect(humanizeAuthError(null)).toBe('Something went wrong. Please try again.');
    expect(humanizeAuthError(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('does not leak raw firebase error codes back to users', () => {
    const knownCodes = [
      'auth/invalid-email',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/too-many-requests',
      'auth/invalid-phone-number',
      'auth/invalid-verification-code',
      'auth/network-request-failed',
    ];
    for (const code of knownCodes) {
      const msg = humanizeAuthError({ code });
      expect(msg).not.toContain('auth/');
    }
  });
});
