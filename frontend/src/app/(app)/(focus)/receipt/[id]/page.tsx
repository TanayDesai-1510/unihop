import { Suspense } from "react";
import { ParamRouteStub } from "@/components/ParamRouteStub";

export default function ReceiptPage() {
  return (
    <Suspense fallback={null}>
      <ParamRouteStub title="Receipt" issue={39} back={{ href: "/rider", label: "Back to home" }} />
    </Suspense>
  );
}
