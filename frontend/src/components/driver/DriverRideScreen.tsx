"use client";

import { useParams } from "next/navigation";
import { TabsChromeProvider } from "@/components/app/TabsChrome";
import { DriverFlow } from "./DriverFlow";

/** Deep link / resume: /driver/ride/[id] renders the driver flow for that ride. Inside <Suspense>. */
export function DriverRideScreen() {
  const { id } = useParams<{ id: string }>();
  return (
    <TabsChromeProvider>
      <DriverFlow initialRideId={id} />
    </TabsChromeProvider>
  );
}
