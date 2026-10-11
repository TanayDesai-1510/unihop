"use client";

import { ArrowUp, Check, Flag, MapPin, Navigation, Star, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { HopIn } from "@/components/brand/Hop";
import { Price } from "@/components/brand/Price";
import { HeroSurface, TicketCard } from "@/components/brand/Road";
import { RoadScene } from "@/components/brand/RoadScene";
import { RoadTimeline } from "@/components/brand/RoadTimeline";
import { RouteSummary } from "@/components/rider/parts";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { springHop, springSmooth } from "@/lib/motion";
import type { Ride } from "@/lib/types";
import type { DriverFlowState } from "./useDriverFlow";

const STEPS = [
  { key: "accepted", label: "Accepted" },
  { key: "arrived", label: "Arrived" },
  { key: "trip", label: "On trip" },
  { key: "done", label: "Dropped off" },
];

const first = (name: string) => name.split(" ")[0];

/** Navigation-style card floating at the top of the map: the one next step, big. */
export function NavCard({ ride, demoGps }: { ride: Ride; demoGps: boolean }) {
  const step =
    ride.status === "ACCEPTED"
      ? { icon: <Navigation aria-hidden size={26} strokeWidth={2.25} />, title: `Head to ${ride.pickupHub.name}`, sub: `Picking up ${first(ride.rider.name)}` }
      : ride.status === "ARRIVED"
        ? { icon: <UserRound aria-hidden size={26} strokeWidth={2.25} />, title: `Pick up ${first(ride.rider.name)}`, sub: `At ${ride.pickupHub.name}` }
        : { icon: <ArrowUp aria-hidden size={26} strokeWidth={2.5} />, title: `Drop off at ${ride.dropoffHub.name}`, sub: `${first(ride.rider.name)} is on board` };
  return (
    <motion.div
      key={ride.status}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSmooth}
      className="hero-surface flex items-center gap-3 rounded-card px-4 py-3 text-on-brand shadow-[var(--shadow-lift)]"
      role="status"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-on-brand/12">{step.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-headline">{step.title}</p>
        <p className="truncate text-label font-normal text-on-brand/75">{step.sub}</p>
      </div>
      {demoGps && <span className="eyebrow shrink-0 rounded-full bg-on-brand/12 px-2 py-1 text-[10px] text-on-brand/80">Demo GPS</span>}
    </motion.div>
  );
}

function RiderLine({ ride }: { ride: Ride }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-headline text-on-brand">
        {ride.rider.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-headline text-ink">{ride.rider.name}</p>
        <p className="inline-flex items-center gap-1 text-label text-ink-muted">
          <Star aria-hidden size={14} strokeWidth={2} className="fill-current" />
          <span className="tnum">{Number(ride.rider.ratingAvg).toFixed(2)}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-label font-normal text-ink-muted">You earn</p>
        <Price amount={ride.fare.driverPayout} size="headline" animated={false} className="text-ink" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pickup leg

export function DriverPickupPanel({ flow, ride }: { flow: DriverFlowState; ride: Ride }) {
  return (
    <div className="flex flex-col gap-4 pb-2">
      <RiderLine ride={ride} />
      <RoadTimeline steps={STEPS} current={0} />
      <RouteSummary pickup={ride.pickupHub} dropoff={ride.dropoffHub} compact />
      <Button variant="primary" leadingIcon={<MapPin aria-hidden size={20} strokeWidth={2} />} onClick={flow.markArrived} loading={flow.acting === "arrived"}>
        I&apos;ve arrived
      </Button>
      <Button variant="ghost" onClick={flow.cancelTrip} loading={flow.acting === "cancel"}>
        Cancel trip
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- at pickup: PIN

export function DriverPinPanel({ flow, ride }: { flow: DriverFlowState; ride: Ride }) {
  const [pin, setPin] = useState("");
  const submit = (value: string) => {
    if (value.length === 4) flow.startTrip(value);
  };
  return (
    <div className="flex flex-col gap-4 pb-2">
      <RiderLine ride={ride} />
      <div>
        <h2 className="text-title text-ink">Enter {first(ride.rider.name)}&apos;s PIN</h2>
        <p className="mt-1 text-label font-normal text-ink-muted">Ask the rider for the 4-digit PIN on their screen before they get in.</p>
      </div>
      <OtpInput
        length={4}
        value={pin}
        onChange={(v) => {
          setPin(v);
          flow.clearPinError();
        }}
        onComplete={submit}
        error={!!flow.pinError}
        shakeKey={flow.pinTries}
        disabled={flow.acting === "start"}
        aria-label="Rider's 4-digit PIN"
      />
      {flow.pinError && (
        <p role="alert" className="-mt-2 text-label text-danger">
          {flow.pinError}
        </p>
      )}
      <Button variant="primary" onClick={() => submit(pin)} loading={flow.acting === "start"} disabledReason={pin.length === 4 ? null : "Enter all 4 digits."}>
        Start trip
      </Button>
      <Button variant="ghost" onClick={flow.cancelTrip} loading={flow.acting === "cancel"}>
        Rider didn&apos;t show
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- on trip

export function DriverTripPanel({ flow, ride }: { flow: DriverFlowState; ride: Ride }) {
  return (
    <div className="flex flex-col gap-4 pb-2">
      <RoadTimeline steps={STEPS} current={2} progress={0.5} />
      <RiderLine ride={ride} />
      <HopIn trigger>
        <Button variant="accent" leadingIcon={<Flag aria-hidden size={20} strokeWidth={2} />} onClick={flow.completeTrip} loading={flow.acting === "complete"}>
          Complete ride
        </Button>
      </HopIn>
    </div>
  );
}

// ---------------------------------------------------------------- done

export function DriverDonePanel({ flow, ride }: { flow: DriverFlowState; ride: Ride }) {
  const [stars, setStars] = useState(0);
  const f = ride.fare;
  return (
    <div className="flex flex-col gap-5 pb-2">
      <HeroSurface className="-mx-5 -mt-3 px-5 pb-6 pt-6">
        <div className="flex items-center gap-3">
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springHop} className="flex size-11 items-center justify-center rounded-full bg-success text-on-brand">
            <Check aria-hidden size={24} strokeWidth={3} />
          </motion.span>
          <div>
            <p className="eyebrow text-on-brand/70">Trip complete</p>
            <p className="text-headline">Nice driving!</p>
          </div>
        </div>
        <p className="mt-5 text-label font-normal text-on-brand/70">You earned</p>
        <Price amount={f.driverPayout} size="hero" countUp />
      </HeroSurface>

      <TicketCard
        top={<RouteSummary pickup={ride.pickupHub} dropoff={ride.dropoffHub} />}
        bottom={
          <dl className="flex flex-col gap-2 text-label">
            <div className="flex justify-between">
              <dt className="font-normal text-ink-muted">Rider paid</dt>
              <dd className="tnum text-ink">${f.total.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-normal text-ink-muted">Platform &amp; safety fee</dt>
              <dd className="tnum text-ink">-${f.platformFee.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-normal text-ink-muted">UniHop share</dt>
              <dd className="tnum text-ink">-${(f.baseFare - f.driverPayout).toFixed(2)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-3">
              <dt className="text-ink">You earn</dt>
              <dd className="tnum font-semibold text-success">${f.driverPayout.toFixed(2)}</dd>
            </div>
          </dl>
        }
      />

      <div className="flex flex-col items-center gap-2">
        <p className="text-headline text-ink">{flow.rated ? `Thanks for rating ${first(ride.rider.name)}` : `Rate ${first(ride.rider.name)}`}</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rate your rider">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <motion.button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              disabled={flow.rated}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setStars(n);
                haptic("tick");
                flow.rate(n);
              }}
              className="flex size-12 items-center justify-center"
            >
              <Star aria-hidden size={32} strokeWidth={1.75} className={cn(stars >= n ? "fill-warning text-warning" : "text-line")} />
            </motion.button>
          ))}
        </div>
      </div>
      <Button variant="primary" onClick={flow.finish}>
        {flow.profile?.isOnline ? "Find next trip" : "Done"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- cancelled

export function DriverEndedPanel({ flow }: { flow: DriverFlowState }) {
  return (
    <div className="flex flex-col items-center gap-3 pb-2 text-center">
      <RoadScene variant="pin" className="h-24" />
      <h2 className="text-title text-ink">Trip cancelled</h2>
      <p className="max-w-[300px] text-label font-normal text-ink-muted">This trip was cancelled. The rider wasn&apos;t charged and you can take the next one.</p>
      <Button variant="primary" className="mt-2" onClick={flow.finish}>
        Back to driving
      </Button>
    </div>
  );
}
