import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

const SIZES = {
  sm: "text-[21px] leading-6",
  md: "text-[28px] leading-8",
  lg: "text-[40px] leading-[44px]",
} as const;

/** "UniHop" in Bricolage Grotesque 800, tight tracking: "Uni" in --brand (--ink in dark), "Hop" in --accent. */
export function Wordmark({ size = "md", onBrand = false, className }: { size?: keyof typeof SIZES; onBrand?: boolean; className?: string }) {
  return (
    <span className={cn("font-display font-extrabold tracking-[-0.045em] [font-optical-sizing:auto]", SIZES[size], className)}>
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
