"use client";

import { Car, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { UserMode } from "@/lib/types";
import { homeFor, useSession } from "./SessionProvider";

/**
 * Rider/Driver switch. Calls PATCH /api/users/me; a 409 DRIVER_NOT_ONBOARDED sends the user to
 * driver onboarding with an explanation instead of failing silently.
 */
export function ModeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { user, status, setMode } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<UserMode | null>(null);

  if (status !== "ready" || !user) {
    return <Skeleton rounded="full" className={cn("h-11 w-full", className)} />;
  }

  const change = async (mode: UserMode) => {
    if (pending) return;
    haptic("tick");
    setPending(mode);
    try {
      await setMode(mode);
      router.push(homeFor(mode));
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "DRIVER_NOT_ONBOARDED") {
        toast.show({ tone: "info", message: "Set up your driver profile to start driving." });
        router.push("/driver/onboard");
      } else {
        toast.show({ tone: "error", message: "Couldn't switch modes. Try again." });
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <SegmentedControl<UserMode>
      aria-label="Mode"
      className={className}
      value={pending ?? user.mode}
      onChange={change}
      options={[
        { value: "RIDER", label: "Ride", icon: compact ? undefined : <UserRound aria-hidden size={20} strokeWidth={2} /> },
        { value: "DRIVER", label: "Drive", icon: compact ? undefined : <Car aria-hidden size={20} strokeWidth={2} /> },
      ]}
    />
  );
}
