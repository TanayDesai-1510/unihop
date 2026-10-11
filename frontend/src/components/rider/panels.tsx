"use client";

import { ArrowLeft, Check, ChevronDown, Clock3, MapPin, MessageCircle, Phone, Search, Share2, ShieldCheck, Star, Wallet } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/brand/AnimatedNumber";
import { HopDots, HopIn } from "@/components/brand/Hop";
import { Price } from "@/components/brand/Price";
import { HeroSurface, LaneDivider, TicketCard } from "@/components/brand/Road";
import { RoadScene } from "@/components/brand/RoadScene";
import { RoadTimeline } from "@/components/brand/RoadTimeline";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { fadeUI, pressable, springHop, springSmooth } from "@/lib/motion";
import { clockAt, PICKUP_ESTIMATE_MIN, tripEstimateSeconds, type RideFlow } from "./useRideFlow";
import { CompactTicket, DriverRow, OptionRow, PaymentLine, PinBoxes, RoundAction, RouteSummary } from "./parts";

const ROAD_STEPS = [
  { key: "accepted", label: "Accepted" },
  { key: "arrived", label: "Arrived" },
  { key: "trip", label: "On trip" },
  { key: "done", label: "Dropped off" },
];

const SHORTCUTS = ["YARD", "BUSCH_SC", "LIVI_SC", "COOK_CC"];
const SHORT_NAME: Record<string, string> = { YARD: "The Yard", BUSCH_SC: "Busch SC", LIVI_SC: "Livingston", COOK_CC: "Cook", DOUGLASS_SC: "Douglass", NB_STATION: "NB Station" };

function PanelTitle({ children, eyebrow, className }: { children: React.ReactNode; eyebrow?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow mb-1 text-ink-muted">{eyebrow}</p>}
      <h2 className="text-title text-ink">{children}</h2>
    </div>
  );
}

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <motion.button type="button" onClick={onClick} {...pressable} aria-label={label} className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink">
      <ArrowLeft aria-hidden size={22} strokeWidth={2} />
    </motion.button>
  );
}

// ---------------------------------------------------------------- home

export function HomePanel({ flow, onExpand }: { flow: RideFlow; onExpand: () => void }) {
  const { hubs, hubsError, loadHubs, pickup } = flow;
  if (hubsError) return <ErrorState message="We couldn't load campus stops. Check your connection and try again." onRetry={loadHubs} />;
  const shortcuts = hubs ? SHORTCUTS.map((c) => hubs.find((h) => h.code === c)).filter((h): h is NonNullable<typeof h> => !!h) : null;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <motion.button
        type="button"
        onClick={onExpand}
        {...pressable}
        className="flex h-[60px] w-full items-center gap-3 rounded-full bg-surface pl-5 pr-2 text-left"
        aria-label="Where to? Choose a drop-off"
      >
        <Search aria-hidden size={22} strokeWidth={2.25} className="text-ink" />
        <span className="flex-1 font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Where to?</span>
        <span className="flex h-11 items-center gap-1.5 rounded-full bg-surface-raised px-3.5 text-label font-semibold text-ink shadow-[var(--shadow-float)]">
          <Clock3 aria-hidden size={16} strokeWidth={2.25} />
          Now
          <ChevronDown aria-hidden size={16} strokeWidth={2.25} />
        </span>
      </motion.button>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {shortcuts
          ? shortcuts.map((h) => {
              const isPickup = h.id === pickup?.id;
              return (
                <motion.button
                  key={h.id}
                  type="button"
                  {...pressable}
                  onClick={() => flow.chooseDropoff(h.id)}
                  aria-disabled={isPickup || undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-label font-semibold",
                    isPickup ? "border-dashed border-line text-ink-muted" : "border-line bg-surface-raised text-ink",
                  )}
                >
                  <MapPin aria-hidden size={16} strokeWidth={2.25} className={isPickup ? "" : "text-brand"} />
                  {SHORT_NAME[h.code] ?? h.name}
                  {isPickup && <span className="sr-only">(your pickup)</span>}
                </motion.button>
              );
            })
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} rounded="full" className="h-11 w-28 shrink-0" />)}
      </div>

      <div className="flex items-center gap-3 rounded-card bg-brand-soft px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
          <MapPin aria-hidden size={18} strokeWidth={2.25} />
        </span>
        <p className="min-w-0 flex-1 truncate text-label font-normal text-ink">
          Pickup at <span className="font-semibold">{pickup?.name ?? "…"}</span>
        </p>
      </div>

      <LaneDivider label="All stops" className="mt-2" />
      <div className="-mx-3 flex flex-col">
        {hubs
          ? hubs.map((h) => (
              <ListRow
                key={h.id}
                leading={<MapPin aria-hidden size={20} strokeWidth={2} />}
                title={h.name}
                subtitle={h.id === pickup?.id ? "Your pickup" : h.zone.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                chevron={h.id !== pickup?.id}
                disabled={h.id === pickup?.id}
                onClick={() => flow.chooseDropoff(h.id)}
              />
            ))
          : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- options

export function OptionsPanel({ flow }: { flow: RideFlow }) {
  const { pickup, dropoff, quote, method, methods, credits, useCredits } = flow;
  if (!pickup || !dropoff) return null;
  const tripS = tripEstimateSeconds(pickup, dropoff);
  const dropoffAt = clockAt((PICKUP_ESTIMATE_MIN * 60 + tripS) * 1000);
  const nextMethod = () => {
    if (!methods?.length) return;
    const i = methods.findIndex((m) => m.id === method?.id);
    flow.setMethodId(methods[(i + 1) % methods.length].id);
  };
  const cashCovers = quote ? Math.min(credits, quote.total) : 0;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center gap-1">
        <BackButton onClick={flow.goHome} label="Change destination" />
        <PanelTitle>Choose a ride</PanelTitle>
      </div>
      <RouteSummary pickup={pickup} dropoff={dropoff} compact />
      <OptionRow fare={quote} pickupMin={PICKUP_ESTIMATE_MIN} dropoffAt={dropoffAt} layoutDependency={flow.phase} />
      <div className="flex flex-col divide-y divide-line">
        {method ? (
          <PaymentLine label={method.label} brand={method.brand} type={method.type} onChange={methods && methods.length > 1 ? nextMethod : undefined} />
        ) : methods ? (
          <Link href="/payment/add?next=/rider" className="py-3 text-body font-semibold text-brand">
            Add a payment method
          </Link>
        ) : (
          <Skeleton className="my-3 h-6 w-48" />
        )}
        {credits > 0 && (
          <label className="flex items-center gap-3 py-2.5">
            <span className="flex size-6 items-center justify-center text-brand">
              <Wallet aria-hidden size={20} strokeWidth={2} />
            </span>
            <span className="flex-1">
              <span className="block text-body text-ink">UniHop Cash</span>
              <span className="block text-label font-normal text-ink-muted">
                {useCredits ? <>Covers <span className="tnum">${cashCovers.toFixed(2)}</span> of this ride</> : <><span className="tnum">${credits.toFixed(2)}</span> available</>}
              </span>
            </span>
            <Switch aria-label="Use UniHop Cash" checked={useCredits} onChange={flow.setUseCredits} />
          </label>
        )}
      </div>
      <Button variant="primary" onClick={flow.toConfirm} disabledReason={quote ? null : "Getting your fare…"}>
        Confirm pickup
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- confirm

export function ConfirmPanel({ flow }: { flow: RideFlow }) {
  const { pickup, dropoff, quote, requesting, requestError } = flow;
  if (!pickup || !dropoff) return null;
  return (
    <div className="flex flex-col gap-4 pb-2">
      <motion.div layoutId="ride-option" layoutDependency={flow.phase} transition={springSmooth} className="rounded-card bg-surface-raised">
        <div className="flex items-start gap-1">
          <BackButton onClick={flow.toOptions} />
          <motion.div layout="position" layoutDependency={flow.phase} className="min-w-0 flex-1 pt-1.5">
            <p className="eyebrow text-ink-muted">Confirm your pickup</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2 key={pickup.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={springSmooth} className="truncate text-title text-ink">
                {pickup.name}
              </motion.h2>
            </AnimatePresence>
          </motion.div>
          <motion.span layout="position" layoutDependency={flow.phase} className="pt-1 text-ink">
            {quote ? <Price amount={quote.total} size="title" /> : null}
          </motion.span>
        </div>
        <p className="mt-2 text-label font-normal text-ink-muted">Drag the map to move the pin. We pick up at campus hubs, so it snaps to the nearest one.</p>
      </motion.div>

      <AnimatePresence initial={false}>
        {requestError && (
          <motion.div
            key={requestError.message}
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="alert"
            className="rounded-input border border-danger px-4 py-3"
          >
            <p className="text-label text-danger">{requestError.message}</p>
            {(requestError.code === "PAYMENT_DECLINED" || requestError.code === "PAYMENT_METHOD_REQUIRED") && (
              <div className="mt-2 flex gap-4">
                <button type="button" onClick={flow.toOptions} className="text-label font-semibold text-brand">
                  Change payment
                </button>
                <Link href="/payment/add?next=/rider" className="text-label font-semibold text-brand">
                  Add a card
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <HopIn trigger={!!quote}>
        <Button variant="accent" onClick={flow.request} loading={requesting} disabledReason={quote ? null : "Getting your fare…"}>
          Request UniHop
        </Button>
      </HopIn>
    </div>
  );
}

// ---------------------------------------------------------------- matching

const MATCH_COPY = [
  { at: 0, text: "Finding your driver" },
  { at: 4, text: "Checking nearby drivers" },
  { at: 10, text: "Almost there" },
];

export function MatchingPanel({ flow }: { flow: RideFlow }) {
  const { ride, pickup, dropoff, requestedAt } = flow;
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!ride || !pickup || !dropoff) return null;
  const elapsed = Math.max(0, Math.floor((now - (requestedAt ?? now)) / 1000));
  const copy = [...MATCH_COPY].reverse().find((c) => elapsed >= c.at)!.text;

  return (
    <div className="flex flex-col gap-5 pb-2">
      {/* Thin progress line across the top of the sheet. */}
      <div aria-hidden className="-mx-5 -mt-3 h-[3px] overflow-hidden bg-brand-soft">
        <motion.div
          className="h-full w-1/3 rounded-full bg-brand"
          animate={reduce ? { opacity: [0.4, 1, 0.4] } : { x: ["-100%", "300%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-ink-muted" aria-live="polite">
            Requested · <span className="font-mono-num normal-case tracking-normal">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={copy}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={reduce ? fadeUI : springSmooth}
              className="mt-1 text-title text-ink"
              aria-live="polite"
            >
              {copy}
            </motion.h2>
          </AnimatePresence>
        </div>
        <HopDots className="mt-6" label="Matching" />
      </div>
      <CompactTicket pickup={pickup} dropoff={dropoff} total={ride.fare.total} payment={ride.payment} layoutDependency={ride.status} />
      <Button variant="ghost" onClick={flow.cancel}>
        Cancel request
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- en route

export function EnRoutePanel({ flow }: { flow: RideFlow }) {
  const toast = useToast();
  const { ride, pickup, dropoff, etaSeconds } = flow;
  if (!ride || !pickup || !dropoff || !ride.driver) return null;
  const arrived = ride.status === "ARRIVED";
  const mins = Math.max(1, Math.round((etaSeconds ?? 180) / 60));
  const share = async () => {
    const text = `I'm on a UniHop ride from ${pickup.name} to ${dropoff.name} with ${ride.driver!.name.split(" ")[0]} (${ride.driver!.plate}).`;
    try {
      if (navigator.share) await navigator.share({ title: "My UniHop ride", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.show({ tone: "success", message: "Trip details copied." });
      }
    } catch {
      // share sheet dismissed
    }
  };
  const unavailable = () => toast.show({ tone: "info", message: "In-app calling and messages aren't set up for the demo yet." });

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div>
        <p className="eyebrow text-ink-muted">{arrived ? "Your driver is here" : "Driver on the way"}</p>
        <h2 className="mt-1 text-title text-ink">
          Meet at {pickup.name}
          {!arrived && (
            <>
              {" "}
              <span className="text-ink-muted">·</span> <AnimatedNumber value={mins} className="tnum" /> min
            </>
          )}
        </h2>
      </div>
      <DriverRow driver={ride.driver} layoutId="driver-card" layoutDependency={ride.status} />
      {ride.pin && (
        <div className="flex flex-col gap-2.5 rounded-card bg-surface p-3">
          <p className="px-1 text-label text-ink">
            Your PIN <span className="font-normal text-ink-muted">· share it with your driver</span>
          </p>
          <PinBoxes pin={ride.pin} />
        </div>
      )}
      <RoadTimeline steps={ROAD_STEPS} current={arrived ? 1 : 0} progress={arrived ? 0 : Math.max(0, 1 - (etaSeconds ?? 180) / 180)} />
      <div className="flex">
        <RoundAction icon={<MessageCircle aria-hidden size={22} strokeWidth={2} />} label="Message" onClick={unavailable} disabledReason="Not set up yet" />
        <RoundAction icon={<Phone aria-hidden size={22} strokeWidth={2} />} label="Call" onClick={unavailable} disabledReason="Not set up yet" />
        <RoundAction icon={<Share2 aria-hidden size={22} strokeWidth={2} />} label="Share" onClick={share} />
        <RoundAction icon={<ShieldCheck aria-hidden size={22} strokeWidth={2} />} label="Safety" tone="safety" onClick={() => window.open("tel:7329327211")} />
      </div>
      <CompactTicket pickup={pickup} dropoff={dropoff} total={ride.fare.total} payment={ride.payment} layoutDependency={ride.status} />
      <Button variant="ghost" onClick={flow.cancel}>
        Cancel ride
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- in trip

export function TripPanel({ flow }: { flow: RideFlow }) {
  const { ride, pickup, dropoff, etaSeconds } = flow;
  // First ETA of the leg sets the scale for timeline progress (adjusted during render, not in an effect).
  const [legTotal, setLegTotal] = useState<number | null>(null);
  if (etaSeconds != null && legTotal == null) setLegTotal(Math.max(etaSeconds, 1));
  if (!ride || !pickup || !dropoff || !ride.driver) return null;
  const eta = etaSeconds ?? tripEstimateSeconds(pickup, dropoff);
  const progress = legTotal ? 1 - eta / legTotal : 0;

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div>
        <p className="eyebrow text-ink-muted">On the way to {dropoff.name}</p>
        <h2 className="mt-1 text-display text-ink">
          Arriving at <span className="tnum">{clockAt(eta * 1000)}</span>
        </h2>
      </div>
      <RoadTimeline steps={ROAD_STEPS} current={2} progress={progress} />
      <DriverRow driver={ride.driver} layoutId="driver-card" layoutDependency={ride.status} />
      <CompactTicket pickup={pickup} dropoff={dropoff} total={ride.fare.total} payment={ride.payment} layoutDependency={ride.status} />
    </div>
  );
}

// ---------------------------------------------------------------- done

export function DonePanel({ flow }: { flow: RideFlow }) {
  const { ride, pickup, dropoff, rated } = flow;
  const [stars, setStars] = useState(0);
  if (!ride || !pickup || !dropoff) return null;
  const f = ride.fare;
  const driverFirst = ride.driver?.name.split(" ")[0] ?? "your driver";
  const pickStar = (n: 1 | 2 | 3 | 4 | 5) => {
    setStars(n);
    haptic("tick");
    flow.rate(n);
  };

  return (
    <div className="flex flex-col gap-5 pb-2">
      <HeroSurface className="-mx-5 -mt-3 px-5 pb-6 pt-6">
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springHop}
            className="flex size-11 items-center justify-center rounded-full bg-success text-on-brand"
          >
            <Check aria-hidden size={24} strokeWidth={3} />
          </motion.span>
          <div>
            <p className="eyebrow text-on-brand/70">Ride complete</p>
            <p className="text-headline">You&apos;ve arrived!</p>
          </div>
        </div>
        <p className="mt-5 text-label font-normal text-on-brand/70">You paid</p>
        <Price amount={ride.payment.amountTotal || f.total} size="hero" countUp className="text-on-brand" />
      </HeroSurface>

      <motion.div layoutId="fare-ticket" layoutDependency={ride.status} transition={springSmooth}>
        <TicketCard
          top={<RouteSummary pickup={pickup} dropoff={dropoff} />}
          bottom={
            <dl className="flex flex-col gap-2 text-label">
              <div className="flex justify-between">
                <dt className="font-normal text-ink-muted">Rider paid</dt>
                <dd className="tnum text-ink">${f.total.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-normal text-ink-muted">Platform &amp; safety fee</dt>
                <dd className="tnum text-ink">${f.platformFee.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-normal text-ink-muted">{driverFirst} earns</dt>
                <dd className="tnum font-semibold text-success">${f.driverPayout.toFixed(2)}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-3">
                <dt className="font-normal text-ink-muted">Paid with</dt>
                <dd className="text-ink">{ride.payment.methodLabel}</dd>
              </div>
            </dl>
          }
        />
      </motion.div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-headline text-ink">{rated ? `Thanks for rating ${driverFirst}` : `How was your ride with ${driverFirst}?`}</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rate your driver">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <motion.button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              disabled={rated}
              onClick={() => pickStar(n)}
              whileTap={{ scale: 0.9 }}
              animate={stars >= n ? { scale: [1, 1.18, 1] } : { scale: 1 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay: (n - 1) * 0.04 }}
              className="flex size-12 items-center justify-center"
            >
              <Star aria-hidden size={32} strokeWidth={1.75} className={cn(stars >= n ? "fill-warning text-warning" : "text-line")} />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={flow.reset}>
          Done
        </Button>
        <Link href={`/receipt/${ride.id}`} className="flex h-11 items-center justify-center text-label font-semibold text-brand">
          View receipt
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ended

export function EndedPanel({ flow }: { flow: RideFlow }) {
  const noDrivers = flow.ride?.status === "NO_DRIVERS";
  return (
    <div className="flex flex-col items-center gap-3 pb-2 text-center">
      <RoadScene variant={noDrivers ? "search" : "pin"} className="h-24" />
      <h2 className="text-title text-ink">{noDrivers ? "No drivers nearby" : "Ride cancelled"}</h2>
      <p className="max-w-[300px] text-label font-normal text-ink-muted">
        {noDrivers ? "No drivers nearby right now. Try again in a minute. You weren't charged." : "Your ride was cancelled. You weren't charged."}
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        {noDrivers && (
          <Button variant="primary" onClick={flow.retry}>
            Try again
          </Button>
        )}
        <Button variant={noDrivers ? "ghost" : "primary"} onClick={flow.reset}>
          {noDrivers ? "Change trip" : "Book another ride"}
        </Button>
      </div>
    </div>
  );
}

