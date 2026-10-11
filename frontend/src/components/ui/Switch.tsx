"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { fadeUI, springUI } from "@/lib/motion";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name when there is no visible label pointing at it. */
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
  /** Track color when on. Brand by default (selection, online); accent only for something live. */
  tone?: "brand" | "success" | "accent";
}

const ON: Record<NonNullable<SwitchProps["tone"]>, string> = { brand: "bg-brand", success: "bg-success", accent: "bg-accent" };

/** 51x31 toggle with a spring thumb; 44px+ hit area. */
export function Switch({ checked, onChange, disabled, tone = "brand", id, ...aria }: SwitchProps) {
  const reduce = useReducedMotion();
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => {
        haptic("tick");
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-0.5",
        "transition-[background-color,transform] duration-150 ease-ui active:scale-[0.97]",
        "after:absolute after:-inset-1.5 after:content-['']",
        checked ? ON[tone] : "bg-line",
        disabled && "opacity-40",
      )}
    >
      <motion.span
        aria-hidden
        animate={{ x: checked ? 20 : 0 }}
        transition={reduce ? fadeUI : springUI}
        className="size-[27px] rounded-full bg-knob shadow-knob"
      />
    </button>
  );
}
