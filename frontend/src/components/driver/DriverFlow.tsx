"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ModeToggle } from "@/components/app/ModeToggle";
import { useSession } from "@/components/app/SessionProvider";
import { useHideNav } from "@/components/app/TabsChrome";
import { GlassSheet } from "@/components/brand/GlassSheet";
import { LogoLockup } from "@/components/brand/Wordmark";
import { RideMap, type MapPhase } from "@/components/map";
import type { SnapPoint } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { fadeUI, springSmooth, stateSwap } from "@/lib/motion";
import { DriverHomePanel, NotDriverPanel, OfferPanel, PickupPanel } from "./panels";
import { useDriverFlow, type DriverPhase } from "./useDriverFlow";

const DETENTS: Record<DriverPhase, SnapPoint[]> = {
  loading: [320],
  "not-driver": [330],
  offline: [340],
  online: [340],
  offer: [470],
  pickup: [300, "88%"],
  arrived: [420, "88%"],
  trip: [320, "88%"],
  done: ["86%"],
  ended: [300],
};

const MAP_PHASE: Record<DriverPhase, MapPhase> = {
  loading: "browse",
  "not-driver": "browse",
  offline: "browse",
  online: "browse",
  offer: "options",
  pickup: "enroute",
  arrived: "enroute",
  trip: "trip",
  done: "done",
  ended: "browse",
};

function phaseInset(phase: DriverPhase): number {
  const first = DETENTS[phase][0];
  if (typeof first === "number") return first;
  const vh = typeof window === "undefined" ? 812 : window.innerHeight;
  return (parseFloat(first) / 100) * vh;
}

/** The driver app on one screen: map behind, one glass sheet whose content follows the driver's state. */
export function DriverFlow({ initialRideId }: { initialRideId?: string }) {
  const flow = useDriverFlow({ initialRideId });
  const { user } = useSession();
  const reduce = useReducedMotion();
  const inRide = ["pickup", "arrived", "trip", "done"].includes(flow.phase);
  useHideNav(inRide);

  const ride = flow.ride;
  const pickupId = flow.offer?.pickupHub.id ?? ride?.pickupHub.id ?? null;
  const dropoffId = flow.offer?.dropoffHub.id ?? ride?.dropoffHub.id ?? null;
  const self = flow.position;

  const panel = (() => {
    switch (flow.phase) {
      case "loading":
        return (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[46px] w-56" />
            <Skeleton rounded="full" className="h-[68px] w-full" />
            <Skeleton rounded="card" className="h-[92px] w-full" />
          </div>
        );
      case "not-driver":
        return <NotDriverPanel />;
      case "offline":
      case "online":
        return <DriverHomePanel flow={flow} firstName={user?.name.split(" ")[0]} />;
      case "offer":
        return <OfferPanel flow={flow} />;
      default:
        return ride ? <PickupPanel ride={ride} pickup={ride.pickupHub} /> : null;
    }
  })();

  return (
    <div className="ride-map absolute inset-0 overflow-hidden bg-surface">
      <RideMap
        hubs={flow.hubs}
        pickupId={pickupId}
        dropoffId={dropoffId}
        phase={MAP_PHASE[flow.phase]}
        driver={inRide && self ? self : null}
        self={self}
        bottomInset={phaseInset(flow.phase)}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="glass-chip pointer-events-auto flex h-12 items-center rounded-full pl-2 pr-4">
          <LogoLockup size={32} />
        </div>
        <AnimatePresence initial={false}>
          {!inRide && !flow.profile?.isOnline && (
            <motion.div
              key="mode"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={reduce ? fadeUI : springSmooth}
              className="glass-chip pointer-events-auto w-[148px] rounded-full p-0.5"
            >
              <ModeToggle compact />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GlassSheet aria-label="Driver" snapPoints={DETENTS[flow.phase]} className="z-[700]">
        <LayoutGroup>
          <motion.div layout layoutDependency={flow.phase} transition={springSmooth} className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={flow.phase}
                initial={reduce ? { opacity: 0 } : flow.phase === "offer" ? { opacity: 0, y: 40, scale: 0.96 } : stateSwap.initial}
                animate={stateSwap.animate}
                exit={reduce ? { opacity: 0 } : stateSwap.exit}
                transition={reduce ? fadeUI : flow.phase === "offer" ? { type: "spring", stiffness: 420, damping: 22 } : springSmooth}
              >
                {panel}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </GlassSheet>
    </div>
  );
}
