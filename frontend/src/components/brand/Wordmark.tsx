import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

const SIZES = {
  sm: "text-[18px] leading-6",
  md: "text-title",
  lg: "text-[32px] leading-9",
} as const;

/** "UniHop" in Geist 700: "Uni" in --brand (--ink in dark mode), "Hop" in --accent (DESIGN.md section 2). */
export function Wordmark({ size = "md", onBrand = false, className }: { size?: keyof typeof SIZES; onBrand?: boolean; className?: string }) {
  return (
    <span className={cn("font-bold tracking-[-0.02em]", SIZES[size], className)}>
      <span className={onBrand ? "text-on-brand" : "text-brand dark:text-ink"}>Uni</span>
      <span className="text-accent">Hop</span>
    </span>
  );
}

/** Mark + wordmark lockup, with the mark's clear space (25% of its width) as the gap. */
export function LogoLockup({ size = 32, wordmark = "sm", className }: { size?: number; wordmark?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: Math.round(size * 0.25) }}>
      <Logo variant="mark" size={size} priority />
      <Wordmark size={wordmark} />
    </span>
  );
}
