import { Suspense } from "react";
import { RiderRideScreen } from "@/components/rider/RiderRideScreen";

export default function RiderRidePage() {
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-surface" />}>
      <RiderRideScreen />
    </Suspense>
  );
}
