"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";

/** App-wide client providers. reducedMotion="user" turns transform animations into instant jumps / fades. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
