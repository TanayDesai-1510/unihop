"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { springSnappy } from "@/lib/motion";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (value: string) => void;
  length?: number;
  error?: boolean;
  /** Bump to shake again for a repeated error. */
  shakeKey?: number;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * N-box code input. One real <input> (autocomplete="one-time-code") sits over the boxes, so typing
 * auto-advances, paste fills every box, and iOS/Android code autofill works. Boxes are visual only.
 */
export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput(
  { value, onChange, onComplete, length = 6, error, shakeKey, disabled, ...aria },
  ref,
) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!);
  const [focused, setFocused] = useState(false);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (error && shakeKey !== undefined && !reduce && scope.current) animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.2 });
  }, [error, shakeKey, reduce, animate, scope]);

  const digits = value.split("");
  const active = Math.min(value.length, length - 1);

  return (
    <div ref={scope} className="relative">
      <input
        ref={input}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        disabled={disabled}
        aria-label={aria["aria-label"] ?? `${length}-digit code`}
        aria-invalid={error || undefined}
        className="absolute inset-0 z-10 h-full w-full cursor-text text-transparent caret-transparent opacity-0"
      />
      <div aria-hidden className="flex gap-2">
        {Array.from({ length }, (_, i) => {
          const isActive = focused && i === active;
          return (
            <motion.span
              key={i}
              animate={{ scale: isActive ? 1.04 : 1 }}
              transition={springSnappy}
              className={cn(
                "relative flex h-14 flex-1 items-center justify-center rounded-input bg-surface font-mono-num text-[26px] text-ink",
                "ring-inset transition-shadow duration-150",
                isActive && "ring-2 ring-brand",
                error && "ring-2 ring-danger",
              )}
            >
              {digits[i] ?? ""}
              {isActive && !digits[i] && <span className="absolute h-6 w-0.5 animate-[skeleton-pulse_1s_steps(1)_infinite] rounded-full bg-brand" />}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
});
