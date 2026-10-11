// UniHop motion system (documented in DESIGN.md section 7).
//
// Springs, not tweens, for anything that moves. Three named springs cover the whole app:
//   snappy  presses, toggles, small controls             (stiffness 500, damping 35)
//   smooth  sheets, cards, state changes, number ticks   (stiffness 260, damping 30)
//   hop     the UniHop micro-signature bounce             (stiffness 600, damping 14)
// Springs start from the current on-screen value and carry velocity, so every animation is
// interruptible. Reduced motion: transforms become short fades (MotionConfig reducedMotion="user",
// plus `fadeUI` where a component chooses its own fallback).
import type { Transition } from "motion/react";

/** DESIGN.md easing, for opacity/color tweens only. */
export const EASE_UI = [0.2, 0.8, 0.2, 1] as const;
export const DURATION = { press: 0.15, sheet: 0.25, state: 0.4 } as const;

export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 35, mass: 1 };
export const springSmooth: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 1 };
export const springHop: Transition = { type: "spring", stiffness: 600, damping: 14, mass: 1 };

/** Press feedback: every pressable scales to this while held. */
export const PRESS_SCALE = 0.97;
export const pressable = { whileTap: { scale: PRESS_SCALE }, transition: springSnappy } as const;

/** Opacity-only fade: the reduced-motion fallback. */
export const fadeUI: Transition = { duration: DURATION.sheet, ease: EASE_UI };

/** Cross-fade + slide for ride states inside a sheet (AnimatePresence mode="popLayout"). */
export const stateSwap = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
} as const;

// Back-compat names used by the base components.
export const springUI = springSmooth;
export const springState = springSmooth;
export const springSheet = springSmooth;
export const springPress = springSnappy;

/**
 * Where a flick would come to rest (Apple's scroll-deceleration projection).
 * velocity in px/s; returns px of extra travel.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Rubber-band resistance past an edge (Apple): the further past, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
