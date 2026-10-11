import { Suspense } from "react";
import { AddCardScreen } from "@/components/payment/AddCardScreen";

export default function AddCardPage() {
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-bg" />}>
      <AddCardScreen />
    </Suspense>
  );
}
