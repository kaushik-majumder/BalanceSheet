/**
 * Thin wrapper around expo-haptics. The module is lazy-required so
 * the existing OTA-only APK (built before haptics was added) doesn't
 * crash on import. When haptics aren't available the helpers no-op.
 *
 * Activate by running a fresh `eas build`; until then the calls are
 * just silent.
 */

type HapticsModule = {
  impactAsync: (style: 'Light' | 'Medium' | 'Heavy' | unknown) => Promise<void>;
  notificationAsync: (type: 'Success' | 'Warning' | 'Error' | unknown) => Promise<void>;
  selectionAsync: () => Promise<void>;
  ImpactFeedbackStyle: { Light: unknown; Medium: unknown; Heavy: unknown };
  NotificationFeedbackType: { Success: unknown; Warning: unknown; Error: unknown };
};

let mod: HapticsModule | null | undefined;
function load(): HapticsModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    mod = require('expo-haptics') as HapticsModule;
  } catch {
    mod = null;
  }
  return mod;
}

const safe = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch {
    // never let a haptic failure surface as an unhandled rejection
  }
};

/** Light tap — for routine taps like toggling a chip. */
export function tapLight(): void {
  const m = load();
  if (!m) return;
  void safe(() => m.impactAsync(m.ImpactFeedbackStyle.Light));
}

/** Medium tap — for confirming a primary action like Save. */
export function tapMedium(): void {
  const m = load();
  if (!m) return;
  void safe(() => m.impactAsync(m.ImpactFeedbackStyle.Medium));
}

/** Heavy tap — for big destructive or significant moments. */
export function tapHeavy(): void {
  const m = load();
  if (!m) return;
  void safe(() => m.impactAsync(m.ImpactFeedbackStyle.Heavy));
}

/** "Success" notification feedback — a satisfying double-pulse on iOS. */
export function notifySuccess(): void {
  const m = load();
  if (!m) return;
  void safe(() => m.notificationAsync(m.NotificationFeedbackType.Success));
}

/** "Warning" notification feedback. */
export function notifyWarning(): void {
  const m = load();
  if (!m) return;
  void safe(() => m.notificationAsync(m.NotificationFeedbackType.Warning));
}

/** "Error" notification feedback. */
export function notifyError(): void {
  const m = load();
  if (!m) return;
  void safe(() => m.notificationAsync(m.NotificationFeedbackType.Error));
}
