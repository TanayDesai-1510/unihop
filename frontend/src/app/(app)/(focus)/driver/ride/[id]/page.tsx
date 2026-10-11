import { Suspense } from "react";
import { DriverRideScreen } from "@/components/driver/DriverRideScreen";

export default function DriverRidePage() {
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-surface" />}>
      <DriverRideScreen />
    </Suspense>
  );
}
