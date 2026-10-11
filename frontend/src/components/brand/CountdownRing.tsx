"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Driver offer countdown (DESIGN.md section 7): a ring that empties over the offer window, in
 * accent, turning danger in the last 5 seconds. Seconds remaining in mono at the center.
 */
export function CountdownRing({ expiresAt, totalSeconds = 15, size = 64, className, onExpire }: { expiresAt: string; totalSeconds?: number; size?: number; className?: string; onExpire?: () => void }) {
  const reduce = useReducedMotion();
  const end = Date.parse(expiresAt);
  const remainingAt = (now: number) => Math.max(0, (end - now) / 1000);
  const [left, setLeft] = useState(() => Math.ceil(remainingAt(Date.now())));
  const progress = useMotionValue(1); // set from the real remaining time in the effect

  useEffect(() => {
    const remaining = remainingAt(Date.now());
    progress.set(Math.min(1, remaining / totalSeconds));
    const anim = reduce ? null : animate(progress, 0, { duration: remaining, ease: "linear" });
    const tick = setInterval(() => {
      const r = remainingAt(Date.now());
      setLeft(Math.ceil(r));
      if (reduce) progress.set(Math.min(1, r / totalSeconds));
      if (r <= 0) {
        clearInterval(tick);
        onExpire?.();
      }
    }, 250);
    return () => {
      anim?.stop();
      clearInterval(tick);
    };
    // restart only when the offer changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const urgent = left <= 5;
  const stroke = 5;
  const r = (size - stroke) / 2;

  return (
    <span role="timer" aria-label={`${left} seconds to respond`} className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "color-mix(in srgb, var(--on-brand) 22%, transparent)" }} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ pathLength: progress, stroke: urgent ? "var(--danger)" : "var(--accent)", transition: "stroke 200ms ease" }}
        />
      </svg>
      <span aria-hidden className="absolute font-mono-num text-[20px] text-on-brand">
        {left}
      </span>
    </span>
  );
}
