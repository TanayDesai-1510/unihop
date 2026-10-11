import { Suspense } from "react";
import { ParamRouteStub } from "@/components/ParamRouteStub";

export default function ReceiptPage() {
  return (
    <Suspense fallback={null}>
      <ParamRouteStub title="Receipt" issue="Receipt with fare breakdown and rating" />
    </Suspense>
  );
}
