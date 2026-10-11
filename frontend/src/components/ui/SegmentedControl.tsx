"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fadeUI, springUI } from "@/lib/motion";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** Shows a pending state on the target segment while a request is in flight. */
  pendingValue?: T | null;
  className?: string;
}

/** Pill selector with a sliding thumb. Radio-group semantics with arrow-key support. */
export function SegmentedControl<T extends string>({ options, value, onChange, pendingValue, className, ...aria }: SegmentedControlProps<T>) {
  const groupId = useId();
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <LayoutGroup id={groupId}>
      <div role="radiogroup" aria-label={aria["aria-label"]} className={cn("relative flex h-11 rounded-full bg-surface p-1", className)}>
        {options.map((o, i) => {
          const selected = o.value === value;
          const pending = pendingValue === o.value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-label={o.label}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => !selected && onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative z-0 flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-label font-semibold",
                "transition-colors duration-150 ease-ui",
                selected ? "text-on-ink" : "text-ink-muted",
                pending && "opacity-60",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="thumb"
                  aria-hidden
                  transition={reduce ? fadeUI : springUI}
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                />
              )}
              {o.icon}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
