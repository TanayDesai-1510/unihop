"use client";

import { useEffect, useState } from "react";
import { GlassSheet } from "@/components/brand/GlassSheet";
import { RoadScene } from "@/components/brand/RoadScene";
import { LogoLockup } from "@/components/brand/Wordmark";
import { RideMap } from "@/components/map";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import type { Hub, UserMode } from "@/lib/types";
import { ModeToggle } from "./ModeToggle";
import { useSession } from "./SessionProvider";

/** Driver home until going online ships: map + glass sheet in the same language as the rider side. */
export function HomeStub({ mode, issue }: { mode: UserMode; issue: number }) {
  const { user, status } = useSession();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [sheetH, setSheetH] = useState(300);
  useEffect(() => {
    api.getHubs().then(setHubs).catch(() => {});
  }, []);
  const first = user?.name.split(" ")[0];

  return (
    <div className="ride-map absolute inset-0 overflow-hidden bg-surface">
      <RideMap hubs={hubs} phase="browse" bottomInset={sheetH} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="glass-chip pointer-events-auto flex h-12 items-center rounded-full pl-2 pr-4">
          <LogoLockup size={32} />
        </div>
        <div className="glass-chip pointer-events-auto w-[148px] rounded-full p-0.5">
          <ModeToggle compact />
        </div>
      </div>
      <GlassSheet aria-label={mode === "DRIVER" ? "Driver" : "Rider"} snapPoints={[300]} onHeightChange={setSheetH} className="z-[700]">
        <div className="flex flex-col gap-4 pb-2">
          <div className="h-[46px]">
            <p className="eyebrow text-ink-muted">{mode === "DRIVER" ? "Driver mode" : "Rider mode"}</p>
            {status === "ready" && first ? <h1 className="mt-1 text-title text-ink">Ready to drive, {first}?</h1> : <Skeleton className="mt-1 h-[30px] w-56" />}
          </div>
          <div className="flex items-center gap-4 rounded-card bg-surface p-4">
            <RoadScene variant="pin" className="h-16 shrink-0" />
            <p className="text-label font-normal text-ink-muted">Going online and trip offers ship with issue #{issue}.</p>
          </div>
        </div>
      </GlassSheet>
    </div>
  );
}
