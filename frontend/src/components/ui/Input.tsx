"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fadeUI, springUI } from "@/lib/motion";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  error?: string | null;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Change this value to re-trigger the shake for the same error text (e.g. a repeat decline). */
  shakeKey?: number | string;
}

/** Height 52, surface fill, no border until focus (2px ink ring), label above, error below. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, error, hint, leading, trailing, shakeKey, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-msg`;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  const lastShake = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    const key = error ? `${error}|${shakeKey ?? ""}` : undefined;
    if (key && key !== lastShake.current && !reduce && scope.current) {
      // One 200ms shake (DESIGN.md section 7), transform only.
      animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.2, ease: "easeOut" });
    }
    lastShake.current = key;
  }, [error, shakeKey, reduce, animate, scope]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className={cn("text-label text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        ref={scope}
        className={cn(
          "flex h-[52px] items-center gap-3 rounded-input bg-surface px-4",
          "ring-inset transition-shadow duration-150 ease-ui focus-within:ring-2 focus-within:ring-ink",
          error && "ring-2 ring-danger focus-within:ring-danger",
        )}
      >
        {leading && <span className="shrink-0 text-ink-muted">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
          {...rest}
        />
        {trailing && <span className="shrink-0">{trailing}</span>}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={messageId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={reduce ? fadeUI : springUI}
            className="text-label text-danger"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p key="hint" id={messageId} className="text-label text-ink-muted">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
