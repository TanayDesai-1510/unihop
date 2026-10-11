"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { springSmooth } from "@/lib/motion";

const SIZE = { hero: "text-hero", display: "text-display", title: "text-title", headline: "text-headline font-semibold tnum" } as const;

export interface PriceProps {
  amount: number;
  size?: keyof typeof SIZE;
  /** Tick between values; `countUp` also counts up from 0 on mount (earnings). */
  animated?: boolean;
  countUp?: boolean;
  className?: string;
}

const dollars = (n: number) => String(Math.floor(Math.round(n * 100) / 100));
const cents = (n: number) => `.${String(Math.round(n * 100) % 100).padStart(2, "0")}`;

/**
 * Money as a price tag (DESIGN.md section 3): "$" and cents at ~55% size, top-aligned.
 * Screen readers hear the plain amount ("$6.50").
 */
export function Price({ amount, size = "display", animated = true, countUp = false, className }: PriceProps) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(countUp ? 0 : amount);
  const major = useTransform(mv, dollars);
  const minor = useTransform(mv, cents);
  const first = useRef(true);

  useEffect(() => {
    if (!animated || reduce) {
      mv.set(amount);
      return;
    }
    const c = animate(mv, amount, first.current && countUp ? { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] } : springSmooth);
    first.current = false;
    return () => c.stop();
  }, [amount, animated, reduce, countUp, mv]);

  return (
    <span className={cn("price", SIZE[size], className)}>
      <span className="sr-only">${amount.toFixed(2)}</span>
      <span aria-hidden className="price-minor price-symbol">
        $
      </span>
      <motion.span aria-hidden>{major}</motion.span>
      <motion.span aria-hidden className="price-minor">
        {minor}
      </motion.span>
    </span>
  );
}
