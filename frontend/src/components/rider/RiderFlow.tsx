"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { ModeToggle } from "@/components/app/ModeToggle";
import { useHideNav } from "@/components/app/TabsChrome";
import { GlassSheet } from "@/components/brand/GlassSheet";
import { LogoLockup } from "@/components/brand/Wordmark";
import { RideMap, type MapPhase } from "@/components/map";
import type { SnapPoint } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { fadeUI, springSmooth, stateSwap } from "@/lib/motion";
import { ConfirmPanel, DonePanel, EndedPanel, EnRoutePanel, HomePanel, MatchingPanel, OptionsPanel, TripPanel } from "./panels";
import { useRideFlow, type RiderPhase } from "./useRideFlow";

/** Detents per phase: content-sized peeks plus a full detent where there's more to see. */
const DETENTS: Record<RiderPhase, SnapPoint[]> = {
  home: [300, "92%"],
  options: [456, "92%"],
  confirm: [292],
  matching: [348],
  enroute: [452, "92%"],
  trip: [352, "88%"],
  done: ["86%"],
  ended: [330],
};

const MAP_PHASE: Record<RiderPhase, MapPhase> = {
  home: "browse",
  options: "options",
  confirm: "confirm",
  matching: "matching",
  enroute: "enroute",
  trip: "trip",
  done: "done",
  ended: "browse",
};

/**
 * The whole rider journey on one screen: map behind, one glass sheet whose content swaps per ride
 * state (cross-fade + slide, height animates), shared elements morph between states.
 */
export function RiderFlow({ initialRideId }: { initialRideId?: string }) {
  const flow = useRideFlow({ initialRideId });
  const reduce = useReducedMotion();
  const [sheetH, setSheetH] = useState(300);
  const [homeSnap, setHomeSnap] = useState(0);
  const inRide = !["home", "options", "confirm"].includes(flow.phase);
  useHideNav(inRide);

  const onPickupSnap = useCallback((id: string) => flow.choosePickup(id), [flow]);
  const onHubTap = useCallback((id: string) => flow.phase === "home" && flow.chooseDropoff(id), [flow]);

  const panel = (() => {
    switch (flow.phase) {
      case "home":
        return <HomePanel flow={flow} onExpand={() => setHomeSnap(1)} />;
      case "options":
        return <OptionsPanel flow={flow} />;
      case "confirm":
        return <ConfirmPanel flow={flow} />;
      case "matching":
        return <MatchingPanel flow={flow} />;
      case "enroute":
        return <EnRoutePanel flow={flow} />;
      case "trip":
        return <TripPanel flow={flow} />;
      case "done":
        return <DonePanel flow={flow} />;
      case "ended":
        return <EndedPanel flow={flow} />;
    }
  })();

  return (
    <div className="ride-map absolute inset-0 overflow-hidden bg-surface">
      <RideMap
        hubs={flow.hubs ?? []}
        pickupId={flow.pickup?.id}
        dropoffId={flow.phase === "home" ? null : flow.dropoff?.id}
        phase={MAP_PHASE[flow.phase]}
        driver={flow.driverPos}
        bottomInset={sheetH}
        onPickupSnap={onPickupSnap}
        onHubTap={onHubTap}
      />

      {/* Floating top bar over the map. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="glass-chip pointer-events-auto flex h-12 items-center rounded-full pl-2 pr-4">
          <LogoLockup size={32} />
        </div>
        <AnimatePresence initial={false}>
          {!inRide && (
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

      <GlassSheet
        aria-label="Ride"
        snapPoints={DETENTS[flow.phase]}
        snap={flow.phase === "home" ? homeSnap : undefined}
        onSnapChange={flow.phase === "home" ? setHomeSnap : undefined}
        onHeightChange={setSheetH}
        className="z-[700]"
      >
        {flow.resuming && !flow.hubs ? (
          <div className="flex flex-col gap-4 pt-1">
            <Skeleton rounded="full" className="h-[60px] w-full" />
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} rounded="full" className="h-11 w-28" />
              ))}
            </div>
          </div>
        ) : (
          <LayoutGroup>
            <motion.div layout transition={springSmooth} className="relative">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={flow.phase}
                  initial={reduce ? { opacity: 0 } : stateSwap.initial}
                  animate={stateSwap.animate}
                  exit={reduce ? { opacity: 0 } : stateSwap.exit}
                  transition={reduce ? fadeUI : springSmooth}
                >
                  {panel}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        )}
      </GlassSheet>
    </div>
  );
}
