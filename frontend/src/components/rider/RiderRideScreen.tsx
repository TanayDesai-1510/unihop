"use client";

import { useParams } from "next/navigation";
import { TabsChromeProvider } from "@/components/app/TabsChrome";
import { RiderFlow } from "./RiderFlow";

/** Deep link / resume: /rider/ride/[id] renders the same flow for that ride. Inside <Suspense>. */
export function RiderRideScreen() {
  const { id } = useParams<{ id: string }>();
  return (
    <TabsChromeProvider>
      <RiderFlow initialRideId={id} />
    </TabsChromeProvider>
  );
}
