"use client";

import { Star, Users } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Price } from "@/components/brand/Price";
import { LaneConnector, LicensePlate } from "@/components/brand/Road";
import { PaymentBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { PRESS_SCALE, pressable, springSmooth } from "@/lib/motion";
import type { DriverCard, FareBreakdown, Hub, PaymentSummary } from "@/lib/types";

/** Real-world paint colors for the car silhouette (vehicle data, not UI palette). */
const CAR_PAINT: Record<string, string> = {
  black: "#1c1f24",
  white: "#f4f5f7",
  silver: "#b9bfc8",
  gray: "#7d848f",
  grey: "#7d848f",
  blue: "#2f5fb3",
  red: "#c7362f",
  green: "#2f7d4f",
  orange: "#e36b2c",
  yellow: "#e6b829",
  brown: "#6e4b33",
  beige: "#d9c9a7",
  gold: "#c9a54a",
};
export const paintFor = (color: string) => CAR_PAINT[color.trim().toLowerCase()] ?? "#7d848f";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Driver avatar sitting over a side-view car silhouette tinted to the car's color. */
export function CarAvatar({ name, carColor, className }: { name: string; carColor: string; className?: string }) {
  const paint = paintFor(carColor);
  return (
    <span aria-hidden className={cn("relative block h-14 w-[76px] shrink-0", className)}>
      <svg viewBox="0 0 88 40" className="absolute bottom-0 left-2 h-[31px] w-[68px]">
        <path d="M6 30c-2 0-3-1-3-3v-5c0-2 1-3 3-4l9-3 9-7c2-1 4-2 6-2h20c2 0 4 1 6 2l9 6 9 2c3 1 5 3 5 6v5c0 2-1 3-3 3Z" fill={paint} />
        <path d="M27 12h11v8H19l6-6c1-1 1-2 2-2Zm14 0h9c2 0 3 1 4 2l5 6H41Z" fill="#0b1630" opacity="0.55" />
        <path d="M6 30c-2 0-3-1-3-3v-5c0-2 1-3 3-4" fill="none" stroke="#0b1630" strokeOpacity="0.15" strokeWidth="1.5" />
        <circle cx="22" cy="31" r="6.5" fill="#0b1630" />
        <circle cx="22" cy="31" r="2.6" fill="#b9bfc8" />
        <circle cx="66" cy="31" r="6.5" fill="#0b1630" />
        <circle cx="66" cy="31" r="2.6" fill="#b9bfc8" />
      </svg>
      <span className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-full border-[3px] border-surface-raised bg-brand text-label font-semibold text-on-brand shadow-[var(--shadow-float)]">
        {initials(name)}
      </span>
    </span>
  );
}

/** Pickup → dropoff with route dots and a dashed lane between them. */
export function RouteSummary({ pickup, dropoff, compact = false, pickupNote, dropoffNote }: { pickup: Hub; dropoff: Hub; compact?: boolean; pickupNote?: ReactNode; dropoffNote?: ReactNode }) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-x-3">
      <span className="flex justify-center pt-[7px]">
        <span className="size-2.5 rounded-full border-[3px] border-brand bg-surface-raised" />
      </span>
      <div className={cn("min-w-0", compact ? "pb-1" : "pb-2")}>
        {!compact && <p className="eyebrow text-ink-muted">Pickup</p>}
        <p className={cn("truncate text-ink", compact ? "text-label" : "text-headline")}>{pickup.name}</p>
        {pickupNote}
      </div>
      <span className="flex justify-center">
        <LaneConnector className={compact ? "h-3" : "h-5"} />
      </span>
      <span />
      <span className="flex justify-center pt-[7px]">
        <span className="size-2.5 rounded-[3px] bg-brand" />
      </span>
      <div className="min-w-0">
        {!compact && <p className="eyebrow text-ink-muted">Drop-off</p>}
        <p className={cn("truncate text-ink", compact ? "text-label" : "text-headline")}>{dropoff.name}</p>
        {dropoffNote}
      </div>
    </div>
  );
}

/** Uber-style option row. Selected: thick navy outline. Morphs (layoutId) into the confirm card. */
export function OptionRow({ fare, pickupMin, dropoffAt, selected = true, onClick }: { fare: FareBreakdown | null; pickupMin: number; dropoffAt: string; selected?: boolean; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      layoutId="ride-option"
      transition={springSmooth}
      onClick={onClick}
      whileTap={{ scale: PRESS_SCALE }}
      aria-pressed={selected}
      className={cn("flex w-full items-center gap-4 rounded-card bg-surface-raised p-4 text-left", selected ? "ring-[2.5px] ring-brand ring-inset" : "ring-1 ring-line ring-inset")}
    >
      <motion.span layout="position" className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" className="size-9 rounded-[9px]" />
      </motion.span>
      <motion.span layout="position" className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-headline text-ink">UniHop</span>
          <span className="inline-flex items-center gap-0.5 text-label text-ink-muted">
            <Users aria-hidden size={14} strokeWidth={2} />4
          </span>
        </span>
        <span className="block truncate text-label font-normal text-ink-muted">
          <span className="tnum">~{pickupMin} min away</span> · drop-off <span className="tnum">{dropoffAt}</span>
        </span>
      </motion.span>
      <motion.span layout="position" className="text-ink">
        {fare ? <Price amount={fare.total} size="title" /> : <span className="inline-block h-7 w-16 animate-[skeleton-pulse_1.4s_ease-in-out_infinite] rounded-[6px] bg-line" />}
      </motion.span>
    </motion.button>
  );
}

/** The fare ticket, compact form. Same layoutId as the receipt ticket so it carries through the ride. */
export function CompactTicket({ pickup, dropoff, total, payment }: { pickup: Hub; dropoff: Hub; total: number; payment?: PaymentSummary | null }) {
  return (
    <motion.div layoutId="fare-ticket" transition={springSmooth} className="ticket">
      <div className="ticket-half ticket-top flex items-center justify-between gap-3 px-4 pb-3 pt-3">
        <p className="min-w-0 truncate text-label text-ink">
          {pickup.name} <span className="text-ink-muted">to</span> {dropoff.name}
        </p>
      </div>
      <div className="ticket-tear" aria-hidden />
      <div className="ticket-half ticket-bottom flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <span className="truncate text-label font-normal text-ink-muted">{payment?.methodLabel ?? "Payment on file"}</span>
        <Price amount={total} size="headline" animated={false} />
      </div>
    </motion.div>
  );
}

/** Ride PIN in four mono boxes. */
export function PinBoxes({ pin }: { pin: string }) {
  return (
    <span role="img" aria-label={`PIN ${pin.split("").join(" ")}`} className="flex gap-2">
      {pin.split("").map((d, i) => (
        <span key={i} aria-hidden className="flex h-14 flex-1 items-center justify-center rounded-input bg-surface-raised font-mono-num text-[28px] text-ink shadow-[var(--shadow-float)]">
          {d}
        </span>
      ))}
    </span>
  );
}

/** Driver identity row: avatar over tinted car, name + rating + car, plate. */
export function DriverRow({ driver, layoutId }: { driver: DriverCard; layoutId?: string }) {
  return (
    <motion.div layoutId={layoutId} transition={springSmooth} className="flex items-center gap-3">
      <CarAvatar name={driver.name} carColor={driver.carColor} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-headline text-ink">
          <span className="truncate">{driver.name.split(" ")[0]}</span>
          <span className="inline-flex items-center gap-0.5 text-label text-ink-muted">
            <Star aria-hidden size={14} strokeWidth={2} className="fill-current" />
            <span className="tnum">{driver.ratingAvg.toFixed(2)}</span>
          </span>
        </p>
        <p className="truncate text-label font-normal text-ink-muted">
          {driver.carColor} {driver.carMake} {driver.carModel}
        </p>
      </div>
      <LicensePlate plate={driver.plate} size="sm" />
    </motion.div>
  );
}

/** Round icon action with a label underneath (message, call, share, safety). */
export function RoundAction({ icon, label, onClick, tone = "default", disabledReason }: { icon: ReactNode; label: string; onClick?: () => void; tone?: "default" | "safety"; disabledReason?: string }) {
  return (
    <motion.button type="button" onClick={onClick} {...pressable} aria-label={disabledReason ? `${label} (unavailable)` : label} className="flex flex-1 flex-col items-center gap-1.5">
      <span className={cn("flex size-12 items-center justify-center rounded-full", tone === "safety" ? "bg-brand-soft text-brand" : "bg-surface text-ink", disabledReason && "opacity-45")}>{icon}</span>
      <span className="text-caption text-ink-muted">{label}</span>
    </motion.button>
  );
}

/** Payment method row inside the options sheet. */
export function PaymentLine({ label, brand, type, onChange }: { label: string; brand: Parameters<typeof PaymentBadge>[0]["brand"]; type: Parameters<typeof PaymentBadge>[0]["type"]; onChange?: () => void }) {
  return (
    <motion.button type="button" onClick={onChange} {...pressable} className="flex w-full items-center gap-3 py-2 text-left">
      <PaymentBadge brand={brand} type={type} />
      <span className="min-w-0 flex-1 truncate text-body text-ink">{label}</span>
      {onChange && <span className="text-label font-semibold text-brand">Change</span>}
    </motion.button>
  );
}
