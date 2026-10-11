import type { PaymentStatus, RideStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export type StatusTone = "live" | "success" | "pending" | "muted" | "danger";

const DOT: Record<StatusTone, string> = {
  live: "bg-brand",
  success: "bg-success",
  pending: "bg-warning",
  muted: "bg-ink-muted",
  danger: "bg-danger",
};

/** Rider-facing copy and tone for each ride status (DESIGN.md: brand in progress, success done, warning pending). */
export const RIDE_STATUS_UI: Record<RideStatus, { label: string; tone: StatusTone }> = {
  REQUESTED: { label: "Finding driver", tone: "pending" },
  ACCEPTED: { label: "Driver on the way", tone: "live" },
  ARRIVED: { label: "Driver arrived", tone: "live" },
  IN_PROGRESS: { label: "On trip", tone: "live" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
  NO_DRIVERS: { label: "No drivers", tone: "muted" },
};

export const PAYMENT_STATUS_UI: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  AUTHORIZED: { label: "Authorized", tone: "pending" },
  CAPTURED: { label: "Paid", tone: "success" },
  VOIDED: { label: "Refunded", tone: "muted" },
  FAILED: { label: "Failed", tone: "danger" },
};

export interface StatusPillProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

/** Caption text with a colored dot. Text stays ink for contrast; the dot carries the color. */
export function StatusPill({ tone, label, className }: StatusPillProps) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-2 rounded-full bg-surface px-3 text-caption text-ink", className)}>
      <span aria-hidden className="relative flex size-2">
        {tone === "live" && <span className={cn("absolute inset-0 rounded-full animate-[status-ping_1.6s_var(--ease-ui)_infinite]", DOT[tone])} />}
        <span className={cn("relative size-2 rounded-full", DOT[tone])} />
      </span>
      {label}
    </span>
  );
}

export function RideStatusPill({ status, className }: { status: RideStatus; className?: string }) {
  const ui = RIDE_STATUS_UI[status];
  return <StatusPill tone={ui.tone} label={ui.label} className={className} />;
}
