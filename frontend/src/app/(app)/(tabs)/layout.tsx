import { Suspense } from "react";
import { BottomNav, BottomNavSkeleton } from "@/components/app/BottomNav";

/** Tab screens: content area above the bottom nav. */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="relative min-h-0 flex-1">{children}</main>
      <Suspense fallback={<BottomNavSkeleton />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
