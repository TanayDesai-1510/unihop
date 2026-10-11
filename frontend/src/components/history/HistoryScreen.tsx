"use client";

import { CarFront, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { homeFor, useSession } from "@/components/app/SessionProvider";
import { Screen } from "@/components/app/Screen";
import { RoadScene } from "@/components/brand/RoadScene";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonGroup, SkeletonListRow } from "@/components/ui/Skeleton";
import { RideStatusPill } from "@/components/ui/StatusPill";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { pressable, springSmooth } from "@/lib/motion";
import {
  TERMINAL_RIDE_STATUSES,
  type RideSummary,
  type UserMode,
} from "@/lib/types";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Activity (issue #44): your trips as a rider and, for drivers, as a driver. Grouped by day. */
export function HistoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const canDrive = !!user?.isDriverApproved;
  const [mode, setMode] = useState<UserMode>(
    user?.mode === "DRIVER" ? "DRIVER" : "RIDER",
  );
  const [rides, setRides] = useState<Record<UserMode, RideSummary[] | null>>({
    RIDER: null,
    DRIVER: null,
  });
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Follow the user's mode once the session loads (adjusted during render).
  const [seededFrom, setSeededFrom] = useState<UserMode | null>(null);
  if (user && seededFrom !== user.mode) {
    setSeededFrom(user.mode);
    setMode(user.mode === "DRIVER" && canDrive ? "DRIVER" : "RIDER");
  }

  useEffect(() => {
    let cancelled = false;
    api
      .getMyRides(mode)
      .then((r) => !cancelled && setRides((all) => ({ ...all, [mode]: r })))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [mode, attempt]);

  const list = rides[mode];
  const groups = useMemo(() => {
    const out: Array<{ day: string; items: RideSummary[] }> = [];
    for (const r of list ?? []) {
      const day = dayLabel(r.completedAt ?? r.requestedAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(r);
      else out.push({ day, items: [r] });
    }
    return out;
  }, [list]);

  const open = (r: RideSummary) => {
    if (r.status === "COMPLETED") router.push(`/receipt/${r.id}`);
    else if (!TERMINAL_RIDE_STATUSES.includes(r.status))
      router.push(
        mode === "DRIVER" ? `/driver/ride/${r.id}` : `/rider/ride/${r.id}`,
      );
    else
      toast.show({
        tone: "info",
        message:
          r.status === "NO_DRIVERS"
            ? "No driver was found for this trip. You weren't charged."
            : "This trip was cancelled. You weren't charged.",
      });
  };

  return (
    <Screen
      title="Activity"
      action={
        canDrive ? (
          <SegmentedControl<UserMode>
            aria-label="Show trips as"
            className="w-[168px]"
            value={mode}
            onChange={(m) => {
              setError(false);
              setMode(m);
            }}
            options={[
              { value: "RIDER", label: "Rides" },
              { value: "DRIVER", label: "Drives" },
            ]}
          />
        ) : undefined
      }
    >
      {error ? (
        <ErrorState
          message="We couldn't load your trips. Check your connection and try again."
          onRetry={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : list === null ? (
        <SkeletonGroup label="Loading trips" className="-mx-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonListRow key={i} />
          ))}
        </SkeletonGroup>
      ) : list.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center">
          <EmptyState
            illustration={
              <RoadScene variant={mode === "DRIVER" ? "coins" : "pin"} />
            }
            title={mode === "DRIVER" ? "No drives yet" : "No rides yet"}
            message={
              mode === "DRIVER"
                ? "Go online and your completed trips and earnings will show up here."
                : "Your trips show up here after your first ride. Every ride is under $10."
            }
            action={{
              label: mode === "DRIVER" ? "Go online" : "Book a ride",
              onClick: () =>
                router.push(mode === "DRIVER" ? "/driver" : homeFor("RIDER")),
            }}
          />
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springSmooth}
            className="flex flex-col gap-6"
          >
            {groups.map((g) => (
              <section
                key={g.day}
                aria-label={g.day}
                className="flex flex-col gap-1"
              >
                <h2 className="eyebrow text-ink-muted">{g.day}</h2>
                <ul className="-mx-3 flex flex-col">
                  {g.items.map((r) => {
                    const done = r.status === "COMPLETED";
                    return (
                      <li key={r.id}>
                        <motion.button
                          type="button"
                          {...pressable}
                          onClick={() => open(r)}
                          className="flex w-full items-start gap-3 rounded-card px-3 py-3 text-left active:bg-surface"
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                            {mode === "DRIVER" ? (
                              <CarFront aria-hidden size={20} strokeWidth={2} />
                            ) : (
                              <MapPin aria-hidden size={20} strokeWidth={2} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium text-ink">
                              {r.dropoffHubName}
                            </span>
                            <span className="mt-0.5 block truncate text-label font-normal text-ink-muted">
                              {new Date(
                                r.completedAt ?? r.requestedAt,
                              ).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}{" "}
                              · From {r.pickupHubName}
                            </span>
                            {!done && (
                              <RideStatusPill
                                status={r.status}
                                className="mt-1.5 h-6 px-2"
                              />
                            )}
                          </span>
                          <span
                            className={cn(
                              "tnum shrink-0 self-start pt-0.5 text-headline",
                              !done
                                ? "text-ink-muted line-through decoration-1"
                                : mode === "DRIVER"
                                  ? "text-success"
                                  : "text-ink",
                            )}
                          >
                            {mode === "DRIVER" && done ? "+" : ""}$
                            {(mode === "DRIVER"
                              ? r.driverPayout
                              : r.total
                            ).toFixed(2)}
                          </span>
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </Screen>
  );
}
