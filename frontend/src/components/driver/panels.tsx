"use client";

import { ChevronRight, MapPin, Star, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useConnectionProblem } from "@/components/app/ConnectionBanner";
import { CountdownRing } from "@/components/brand/CountdownRing";
import { Price } from "@/components/brand/Price";
import { HeroSurface } from "@/components/brand/Road";
import { RoadScene } from "@/components/brand/RoadScene";
import { RouteSummary } from "@/components/rider/parts";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { pressable } from "@/lib/motion";
import { OnlineToggle } from "./OnlineToggle";
import type { DriverFlowState } from "./useDriverFlow";

const miles = (m: number) => `${(m / 1609.34).toFixed(1)} mi`;

// ---------------------------------------------------------------- home (offline / online)

export function DriverHomePanel({ flow, firstName }: { flow: DriverFlowState; firstName?: string }) {
  const { profile, earnings, toggling, watchedHub } = flow;
  const online = !!profile?.isOnline;
  const { problem, offline } = useConnectionProblem();
  const cutOff = online && problem;
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <p className="eyebrow text-ink-muted">Driver mode</p>
        <h1 className="mt-1 text-title text-ink">
          {cutOff ? "Reconnecting…" : watchedHub ? `Watching for rides to ${watchedHub.name}` : online ? "Finding you a trip" : `Ready to drive${firstName ? `, ${firstName}` : ""}?`}
        </h1>
        {cutOff && (
          <p role="status" className="mt-1 flex items-start gap-1.5 text-label font-normal text-ink">
            <WifiOff aria-hidden size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" />
            {offline ? "You're offline." : "Can't reach UniHop."} {"You won't get trip requests until you're connected again."}
          </p>
        )}
      </div>
      <OnlineToggle online={online} pending={toggling} onToggle={flow.toggleOnline} />
      <motion.div {...pressable}>
        <Link href="/earnings" className="flex items-center gap-4 rounded-card bg-surface p-4">
          <div className="min-w-0 flex-1">
            <p className="text-label font-normal text-ink-muted">Today</p>
            {earnings ? <Price amount={earnings.today} size="display" className="text-ink" /> : <Skeleton className="mt-1 h-10 w-28" />}
          </div>
          <div className="text-right">
            <p className="text-label font-normal text-ink-muted">This week</p>
            {earnings ? <p className="tnum text-headline text-ink">${earnings.week.toFixed(2)}</p> : <Skeleton className="ml-auto mt-1 h-5 w-16" />}
            <p className="tnum text-caption font-medium text-ink-muted">{earnings ? `${earnings.rides.length} trip${earnings.rides.length === 1 ? "" : "s"}` : ""}</p>
          </div>
          <ChevronRight aria-hidden size={20} strokeWidth={2} className="text-ink-muted" />
        </Link>
      </motion.div>
      {!online && <p className="text-center text-label font-normal text-ink-muted">Go online to get trip requests near you. You earn 90% of every base fare.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- offer

export function OfferPanel({ flow }: { flow: DriverFlowState }) {
  const { offer, responding } = flow;
  if (!offer) return null;
  return (
    <div className="flex flex-col gap-4 pb-2">
      <HeroSurface className="-mx-5 -mt-3 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-on-brand/70">New trip request</p>
            <p className="mt-2 text-label font-normal text-on-brand/75">You earn</p>
            <Price amount={offer.fare.driverPayout} size="hero" animated={false} />
          </div>
          <CountdownRing key={offer.offerId} expiresAt={offer.expiresAt} onExpire={flow.expire} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-label font-normal text-on-brand/80">
          <MapPin aria-hidden size={16} strokeWidth={2} />
          <span className="tnum">{miles(offer.distanceToPickupMeters)}</span> to pickup · rider pays <span className="tnum">${offer.fare.total.toFixed(2)}</span>
        </p>
      </HeroSurface>
      <div className="flex items-center justify-between gap-3">
        <p className="text-headline text-ink">{offer.riderName.split(" ")[0]}</p>
        <span className="inline-flex items-center gap-1 text-label text-ink-muted">
          <Star aria-hidden size={14} strokeWidth={2} className="fill-current" />
          <span className="tnum">{offer.riderRating.toFixed(2)}</span>
        </span>
      </div>
      <RouteSummary pickup={offer.pickupHub} dropoff={offer.dropoffHub} />
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1 border border-line" onClick={flow.decline} loading={responding === "decline"} disabled={responding === "accept"}>
          Decline
        </Button>
        <Button variant="accent" className="flex-[2]" onClick={flow.accept} loading={responding === "accept"} disabled={responding === "decline"}>
          Accept
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- not a driver yet

export function NotDriverPanel() {
  return (
    <div className="flex flex-col items-center gap-3 pb-2 text-center">
      <RoadScene variant="pin" className="h-24" />
      <h2 className="text-title text-ink">Drive with UniHop</h2>
      <p className="max-w-[300px] text-label font-normal text-ink-muted">Add your car to start getting trip requests. It takes a minute.</p>
      <Link href="/driver/onboard" className="mt-1 w-full">
        <Button variant="primary">Set up driver profile</Button>
      </Link>
    </div>
  );
}


