"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { springHop, springSnappy } from "@/lib/motion";

/**
 * The hop: UniHop's micro-signature bounce (DESIGN.md section 3b). Wraps a child and hops it once
 * (translateY -3px, hop spring back) every time `trigger` changes to a truthy value, e.g. when the
 * accent CTA becomes enabled or a success check appears.
 */
export function HopIn({ trigger, children, className, height = 3 }: { trigger: unknown; children: ReactNode; className?: string; height?: number }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  const prev = useRef(trigger);

  useEffect(() => {
    const changed = trigger !== prev.current;
    prev.current = trigger;
    if (!changed || !trigger || reduce || !scope.current) return;
    let cancelled = false;
    (async () => {
      await animate(scope.current, { y: -height }, springSnappy);
      if (!cancelled) await animate(scope.current, { y: 0 }, springHop);
    })();
    return () => {
      cancelled = true;
    };
  }, [trigger, reduce, animate, scope, height]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}

/** Loader: three dots hopping in sequence (instead of a spinner where space allows). */
export function HopDots({ className, label = "Loading", tone = "brand" }: { className?: string; label?: string; tone?: "brand" | "accent" | "current" }) {
  const reduce = useReducedMotion();
  const color = tone === "brand" ? "bg-brand" : tone === "accent" ? "bg-accent" : "bg-current";
  return (
    <span role="status" className={cn("inline-flex items-end gap-1.5", className)}>
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className={cn("size-2 rounded-full", color)}
          animate={reduce ? { opacity: [0.35, 1, 0.35] } : { y: [0, -7, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.25, delay: i * 0.12, ease: [0.3, 0, 0.3, 1] }}
        />
      ))}
    </span>
  );
}
