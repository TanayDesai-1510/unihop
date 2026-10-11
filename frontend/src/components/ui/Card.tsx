import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "raised" floats on the page (shadow in light, border in dark). "flat" sits inside another surface. */
  elevation?: "raised" | "flat";
  padded?: boolean;
}

/** surface-raised, radius 16, padding 16 (DESIGN.md section 6). */
export function Card({ elevation = "raised", padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card",
        elevation === "raised" ? "border border-elevated-border bg-surface-raised shadow-float" : "bg-surface",
        padded && "p-4",
        className,
      )}
      {...rest}
    />
  );
}
