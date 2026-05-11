import { NativeModules } from 'react-native';

/**
 * Thin wrapper around expo-haptics. We're VERY careful here because
 * the existing APK was built before expo-haptics was added to
 * package.json — its native module isn't linked, and trying to call
 * it can crash the JS bridge (taking down the whole app).
 *
 * Defense in depth:
 *
 *   1. Check NativeModules for any known haptics-module name BEFORE
 *      we even `require()` the JS shim. If nothing's registered on
 *      the native side, we stay in pure-no-op mode and never load
 *      the shim at all.
 *
 *   2. Even if the shim loads, every method call is wrapped in a
 *      try/catch so a runtime failure can't escape.
 *
 * Activate by running a fresh `eas build`; until then the calls are
 * silent and safe.
 */

// Possible names the native module might be registered under across
// expo-haptics versions and Expo Modules vs. legacy bridge installs.
const HAPTICS_NATIVE_KEYS = [
  'ExpoHaptics',
  'ExponentHaptic',
  'RNHaptic',
  'RNCHaptic',
];
const HAPTICS_AVAILABLE: boolean =
  !!NativeModules &&
  HAPTICS_NATIVE_KEYS.some((k) => !!(NativeModules as Record<string, unknown>)[k]);

type HapticsModule = {
  impactAsync: (style: unknown) => Promise<void>;
  notificationAsync: (type: unknown) => Promise<void>;
  ImpactFeedbackStyle: { Light: unknown; Medium: unknown; Heavy: unknown };
  NotificationFeedbackType: { Success: unknown; Warning: unknown; Error: unknown };
};

let mod: HapticsModule | null | undefined;
function load(): HapticsModule | null {
  if (!HAPTICS_AVAILABLE) return null;
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const candidate = require('expo-haptics') as Partial<HapticsModule>;
    if (
      !candidate?.impactAsync ||
      !candidate?.notificationAsync ||
      !candidate?.ImpactFeedbackStyle?.Medium
    ) {
      mod = null;
    } else {
      mod = candidate as HapticsModule;
    }
  } catch {
    mod = null;
  }
  return mod;
}

function safeRun(fn: () => Promise<unknown>): void {
  try {
    const result = fn();
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => {
        // never let a haptic rejection bubble
      });
    }
  } catch {
    // synchronous throws from native bridge calls land here
  }
}

/** Light tap — for routine taps like toggling a chip. */
export function tapLight(): void {
  const m = load();
  if (!m) return;
  safeRun(() => m.impactAsync(m.ImpactFeedbackStyle.Light));
}

/** Medium tap — for confirming a primary action like Save. */
export function tapMedium(): void {
  const m = load();
  if (!m) return;
  safeRun(() => m.impactAsync(m.ImpactFeedbackStyle.Medium));
}

/** Heavy tap — for big destructive or significant moments. */
export function tapHeavy(): void {
  const m = load();
  if (!m) return;
  safeRun(() => m.impactAsync(m.ImpactFeedbackStyle.Heavy));
}

/** "Success" notification feedback — a satisfying double-pulse on iOS. */
export function notifySuccess(): void {
  const m = load();
  if (!m) return;
  safeRun(() => m.notificationAsync(m.NotificationFeedbackType.Success));
}

/** "Warning" notification feedback. */
export function notifyWarning(): void {
  const m = load();
  if (!m) return;
  safeRun(() => m.notificationAsync(m.NotificationFeedbackType.Warning));
}

/** "Error" notification feedback. */
export function notifyError(): void {
  const m = load();
  if (!m) return;
  safeRun(() => m.notificationAsync(m.NotificationFeedbackType.Error));
}
