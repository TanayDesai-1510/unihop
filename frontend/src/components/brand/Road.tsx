import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Dashed lane divider (rounded dashes, like the logo road). Optional centered label. */
export function LaneDivider({ label, className }: { label?: ReactNode; className?: string }) {
  const lane = <span aria-hidden className="h-[3px] flex-1 bg-[radial-gradient(circle,var(--line)_1.5px,transparent_1.6px)] bg-[length:10px_3px] bg-repeat-x" />;
  return (
    <div role="separator" className={cn("flex items-center gap-3", className)}>
      {lane}
      {label && (
        <>
          <span className="eyebrow text-ink-muted">{label}</span>
          {lane}
        </>
      )}
    </div>
  );
}

/** Vertical pickup-to-dropoff connector: a short dashed lane between two route dots. */
export function LaneConnector({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block w-[3px] bg-[radial-gradient(circle,var(--line)_1.5px,transparent_1.6px)] bg-[length:3px_8px] bg-repeat-y", className)}
    />
  );
}

/**
 * The ticket (DESIGN.md section 3b): perforated notches on both sides and a dashed tear line
 * between `top` (route) and `bottom` (price). Notches are real cut-outs (CSS mask), so the ticket
 * works on any surface, including glass sheets and maps.
 */
export function TicketCard({ top, bottom, className }: { top: ReactNode; bottom: ReactNode; className?: string }) {
  return (
    <div className={cn("ticket", className)}>
      <div className="ticket-half ticket-top px-5 pb-5 pt-5">{top}</div>
      <div className="ticket-tear" aria-hidden />
      <div className="ticket-half ticket-bottom px-5 pb-5 pt-5">{bottom}</div>
    </div>
  );
}

/** A real license plate: white, navy border, mono 600, slight inner shadow. */
export function LicensePlate({ plate, state = "NEW JERSEY", size = "md", className }: { plate: string; state?: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`License plate ${plate.split("").join(" ")}`}
      className={cn(
        "inline-flex flex-col items-center rounded-[8px] border-2 border-brand-logo bg-knob text-brand-logo shadow-[inset_0_-2px_0_rgba(14,17,22,0.08),inset_0_1px_2px_rgba(14,17,22,0.12)]",
        size === "md" ? "px-3 pb-1 pt-0.5" : "px-2 pb-0.5 pt-0",
        className,
      )}
    >
      <span aria-hidden className={cn("font-semibold uppercase tracking-[0.14em]", size === "md" ? "text-[8px] leading-3" : "text-[7px] leading-[10px]")}>
        {state}
      </span>
      <span aria-hidden className={cn("font-mono-num leading-none tracking-[0.06em]", size === "md" ? "text-[22px]" : "text-[16px]")}>
        {plate}
      </span>
    </span>
  );
}

/**
 * Navy hero surface (login, splash, offer, receipt top halves): full-bleed logo navy with a soft
 * orange radial glow in one corner (~12%). Uses the constant logo navy so dark mode keeps white
 * type legible (dark --brand is a light blue).
 */
export function HeroSurface({ children, className, glow = "top-right" }: { children: ReactNode; className?: string; glow?: "top-right" | "bottom-left" }) {
  return (
    <div className={cn("hero-surface relative isolate overflow-hidden text-on-brand", glow === "bottom-left" && "hero-glow-bl", className)}>
      {children}
    </div>
  );
}
