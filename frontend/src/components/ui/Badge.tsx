import type { ReactNode } from "react";
import type { CardBrand, PaymentMethodType } from "@/lib/types";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "inverse";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink",
  brand: "bg-brand-soft text-brand-strong",
  accent: "bg-accent-soft text-ink",
  // Outlined: green/yellow fills can't carry 12px text at AA in both modes; ink on bg can.
  success: "border border-success text-ink",
  warning: "border border-warning text-ink",
  danger: "border border-danger text-danger",
  inverse: "bg-brand text-on-brand",
};

/** Small rounded label (caption). */
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[6px] px-2 text-caption", TONES[tone], className)}>{children}</span>
  );
}

const BRAND_TEXT: Record<CardBrand, string> = { VISA: "VISA", MASTERCARD: "MC", AMEX: "AMEX", DISCOVER: "DISC" };

/**
 * Text-only card brand / wallet badge (no logo artwork, DESIGN.md section 6).
 * Fixed width so lists of methods line up.
 */
export function PaymentBadge({ brand, type = "CARD", className }: { brand: CardBrand; type?: PaymentMethodType; className?: string }) {
  const text = type === "APPLE_PAY" ? "APPLE" : type === "GOOGLE_PAY" ? "GPAY" : BRAND_TEXT[brand];
  return (
    <span
      aria-label={type === "CARD" ? brand.toLowerCase() : type === "APPLE_PAY" ? "Apple Pay" : "Google Pay"}
      className={cn(
        "inline-flex h-6 w-12 items-center justify-center rounded-[6px] border border-line bg-surface-raised",
        "text-[10px] font-bold leading-none tracking-[0.06em] text-ink",
        className,
      )}
    >
      {text}
    </span>
  );
}
