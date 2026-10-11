"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { springSmooth } from "@/lib/motion";

export interface AnimatedNumberProps {
  value: number;
  /** Formats the in-between values. Default: integer. */
  format?: (n: number) => string;
  /** Count up from this value on mount (earnings). Default: start at `value` (no mount animation). */
  from?: number;
  className?: string;
}

/**
 * A number that ticks to its new value (fares, ETAs, earnings). The text is written straight from a
 * motion value, so ticking never re-renders React. Reduced motion: jumps.
 */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), from, className }: AnimatedNumberProps) {
  const mv = useMotionValue(from ?? value);
  const text = useTransform(mv, format);
  const reduce = useReducedMotion();
  const first = useRef(true);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, first.current && from !== undefined ? { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] } : springSmooth);
    first.current = false;
    return () => controls.stop();
  }, [value, reduce, mv, from]);

  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  );
}
