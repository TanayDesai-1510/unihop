// Shared motion presets (DESIGN.md section 7). Springs, never linear tweens, for anything that moves.
// Spring values follow Apple's fluid-interface defaults: critically damped (bounce 0) unless the
// motion was started by a gesture that carried momentum, which gets a little bounce.
import type { Transition } from "motion/react";

/** DESIGN.md easing curve, for tweens on opacity/color. */
export const EASE_UI = [0.2, 0.8, 0.2, 1] as const;

export const DURATION = { press: 0.15, sheet: 0.25, state: 0.4 } as const;

/** Default UI spring: no overshoot. Cards in/out, toasts, small repositioning. */
export const springUI: Transition = { type: "spring", bounce: 0, visualDuration: 0.25 };

/** Major state change (ride status, screen-level swaps). */
export const springState: Transition = { type: "spring", bounce: 0, visualDuration: 0.4 };

/** Sheet snapping after a drag: momentum carried, so a touch of bounce. */
export const springSheet: Transition = { type: "spring", bounce: 0.15, visualDuration: 0.3 };

/** Press feedback (scale 0.98). */
export const springPress: Transition = { type: "spring", bounce: 0, visualDuration: DURATION.press };

/** Opacity-only fade used as the reduced-motion fallback. */
export const fadeUI: Transition = { duration: DURATION.sheet, ease: EASE_UI };

/**
 * Where a flick would come to rest (Apple's scroll-deceleration projection).
 * velocity in px/s; returns px of extra travel.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
