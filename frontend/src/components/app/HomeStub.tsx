"use client";

import { Car, MapPinned } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import type { UserMode } from "@/lib/types";
import { ModeToggle } from "./ModeToggle";
import { useSession } from "./SessionProvider";

/** Home tab until the map screens land: greeting + Rider/Driver toggle. */
export function HomeStub({ mode, issue }: { mode: UserMode; issue: number }) {
  const { user, status } = useSession();
  const first = user?.name.split(" ")[0];

  return (
    <div className="absolute inset-0 flex flex-col">
      <header className="flex flex-col gap-4 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <ModeToggle />
        <div className="h-[30px]">
          {status === "ready" && first ? (
            <h1 className="text-title text-ink">{mode === "DRIVER" ? `Ready to drive, ${first}?` : `Where to, ${first}?`}</h1>
          ) : (
            <Skeleton className="h-[30px] w-56" />
          )}
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={mode === "DRIVER" ? <Car aria-hidden size={24} strokeWidth={2} /> : <MapPinned aria-hidden size={24} strokeWidth={2} />}
          title={mode === "DRIVER" ? "Driver home" : "Ride booking"}
          message={`The map and ${mode === "DRIVER" ? "offers" : "booking flow"} ship with issue #${issue}.`}
        />
      </div>
    </div>
  );
}
