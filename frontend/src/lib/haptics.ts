// Haptics via the Vibration API (Android Chrome; iOS Safari ignores it silently).
// Fire on the same frame as the visual change that caused it, and only on key moments.

const PATTERNS = {
  /** Light tick: snap points, toggles, hub chips. */
  tick: 8,
  /** A driver offer arrives (driver app). */
  offer: [30, 60, 30, 60, 40],
  /** A driver accepted your ride / you accepted an offer. */
  accepted: [20, 40, 40],
  /** Driver arrived at the pickup. */
  arrived: [40, 80, 40],
  /** Payment succeeded, ride completed. */
  success: [15, 30, 25],
  /** Card declined or blocking error: short double pulse. */
  error: [35, 45, 35],
} as const satisfies Record<string, number | readonly number[]>;

export type HapticKind = keyof typeof PATTERNS;

export function haptic(kind: HapticKind): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    const p = PATTERNS[kind];
    navigator.vibrate(typeof p === "number" ? p : [...p]);
  } catch {
    // Some browsers throw if called without a user gesture; haptics are best-effort.
  }
}
