jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

import * as SecureStore from 'expo-secure-store';
import {
  getBiometricAsked,
  getBiometricEnabled,
  getOnboardingSeen,
  setBiometricAsked,
  setBiometricEnabled,
  setOnboardingSeen,
} from '../lib/secureStorage';

const mockedStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  mockedStore.clear();
  jest.clearAllMocks();
});

describe('onboarding flag', () => {
  it('returns false when never set', async () => {
    expect(await getOnboardingSeen()).toBe(false);
  });

  it('returns true after marking seen', async () => {
    await setOnboardingSeen();
    expect(await getOnboardingSeen()).toBe(true);
  });

  it('persists under a stable key (do not rename without a migration)', async () => {
    await setOnboardingSeen();
    expect(mockedStore.get('bs.onboarding.seen')).toBe('1');
  });
});

describe('biometric enabled flag', () => {
  it('defaults to false', async () => {
    expect(await getBiometricEnabled()).toBe(false);
  });

  it('persists when enabled', async () => {
    await setBiometricEnabled(true);
    expect(await getBiometricEnabled()).toBe(true);
  });

  it('clears the entry when disabled (delete, not write 0)', async () => {
    await setBiometricEnabled(true);
    await setBiometricEnabled(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('bs.biometric.enabled');
    expect(await getBiometricEnabled()).toBe(false);
  });

  it('uses the documented storage key', async () => {
    await setBiometricEnabled(true);
    expect(mockedStore.get('bs.biometric.enabled')).toBe('1');
  });
});

describe('biometric asked flag', () => {
  it('defaults to false (never asked)', async () => {
    expect(await getBiometricAsked()).toBe(false);
  });

  it('flips to true once asked, regardless of user choice', async () => {
    await setBiometricAsked();
    expect(await getBiometricAsked()).toBe(true);
  });

  it('is independent from biometricEnabled — declined users stay asked=true, enabled=false', async () => {
    await setBiometricAsked();
    expect(await getBiometricAsked()).toBe(true);
    expect(await getBiometricEnabled()).toBe(false);
  });
});

describe('storage key namespace', () => {
  it('all keys share the bs. prefix to avoid collisions', async () => {
    await setOnboardingSeen();
    await setBiometricEnabled(true);
    await setBiometricAsked();
    for (const key of mockedStore.keys()) {
      expect(key.startsWith('bs.')).toBe(true);
    }
  });
});
