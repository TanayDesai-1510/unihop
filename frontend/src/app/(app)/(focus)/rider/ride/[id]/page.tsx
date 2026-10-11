import { Suspense } from "react";
import { ParamRouteStub } from "@/components/ParamRouteStub";

export default function RiderRidePage() {
  return (
    <Suspense fallback={null}>
      <ParamRouteStub title="Your ride" issue={35} />
    </Suspense>
  );
}
