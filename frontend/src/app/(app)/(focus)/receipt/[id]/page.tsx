import { Suspense } from "react";
import { ReceiptScreen } from "@/components/receipt/ReceiptScreen";

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="hero-surface absolute inset-x-0 top-0 h-64" />}>
      <ReceiptScreen />
    </Suspense>
  );
}
