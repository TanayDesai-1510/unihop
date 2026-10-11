"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { fadeUI, springSmooth } from "@/lib/motion";

export interface RoadStep {
  key: string;
  label: string;
}

export interface RoadTimelineProps {
  steps: RoadStep[];
  /** Index of the current step (0-based). */
  current: number;
  /** 0..1 progress toward the next step, so the car can creep forward between statuses. */
  progress?: number;
  className?: string;
}

/**
 * The ride timeline as a road (DESIGN.md section 3b): a dashed lane with stops; a small car glides
 * along it as status advances. Traveled lane turns solid navy; the car is the live accent.
 */
export function RoadTimeline({ steps, current, progress = 0, className }: RoadTimelineProps) {
  const reduce = useReducedMotion();
  const segments = Math.max(steps.length - 1, 1);
  const pos = Math.min(1, (Math.min(current, segments) + Math.min(Math.max(progress, 0), 0.92)) / segments);
  const pct = `${(pos * 100).toFixed(2)}%`;

  return (
    <div className={cn("w-full", className)}>
      <ol className="sr-only">
        {steps.map((s, i) => (
          <li key={s.key} aria-current={i === current ? "step" : undefined}>
            {s.label}
            {i < current ? " (done)" : i === current ? " (now)" : ""}
          </li>
        ))}
      </ol>
      <div aria-hidden className="relative mx-3 h-10">
        {/* Lane: rounded dashes like the logo's road. */}
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[radial-gradient(circle,var(--line)_2px,transparent_2.1px)] bg-[length:12px_4px] bg-repeat-x" />
        {/* Traveled lane (scaleX, so it stays on the compositor). */}
        <motion.div
          className="absolute left-0 top-1/2 h-1 w-full origin-left -translate-y-1/2 rounded-full bg-brand"
          initial={false}
          animate={{ scaleX: pos }}
          transition={reduce ? fadeUI : springSmooth}
        />
        {/* Stops */}
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-300",
              i <= current ? "border-brand bg-brand" : "border-line bg-surface-raised",
            )}
            style={{ left: `${(i / segments) * 100}%` }}
          />
        ))}
        {/* The car: a full-width track translated by `pos` of its own width. */}
        <motion.div className="absolute inset-0" initial={false} animate={{ x: pct }} transition={reduce ? fadeUI : springSmooth}>
          <span className="absolute left-0 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-surface-raised bg-accent text-on-accent shadow-[var(--shadow-lift)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="rotate-90">
              <path d="M12 2 19.5 20.6c.2.5-.3 1-.8.7L12 18l-6.7 3.3c-.5.3-1-.2-.8-.7Z" />
            </svg>
          </span>
        </motion.div>
      </div>
      <div aria-hidden className="mt-1 flex justify-between">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "w-0 flex-1 text-caption transition-colors duration-300",
              i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center",
              i === current ? "text-ink" : i < current ? "text-ink-muted" : "text-ink-muted/60",
            )}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
