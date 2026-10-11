"use client";

import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";
import { useSession } from "./SessionProvider";

/** Screens render while the session loads (they show their own skeletons); a load failure gets a retry. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useSession();
  if (status === "error") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorState message={error ?? "Something went wrong."} onRetry={reload} />
      </div>
    );
  }
  return <>{children}</>;
}
