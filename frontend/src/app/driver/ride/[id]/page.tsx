import { Suspense } from "react";
import { ParamRouteStub } from "@/components/ParamRouteStub";

export default function DriverRidePage() {
  return (
    <Suspense fallback={null}>
      <ParamRouteStub title="Driver ride" issue="Driver active ride" />
    </Suspense>
  );
}
