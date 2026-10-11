// Haptics via the Vibration API (Android Chrome; iOS Safari ignores it silently).
// Fire on the same frame as the visual change that caused it, and only on key moments.

const PATTERNS = {
  /** Light tick: snap points, toggles. */
  tick: 8,
  /** A driver offer arrives. */
  offer: [30, 60, 30],
  /** Driver accepted your ride. */
  accepted: [20, 40, 40],
  /** Payment succeeded, ride completed. */
  success: [15, 30, 25],
  /** Decline or blocking error. */
  error: [40, 50, 40],
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
