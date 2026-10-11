import { Suspense } from "react";
import { BottomNav, BottomNavSkeleton } from "@/components/app/BottomNav";
import { TabsChromeProvider } from "@/components/app/TabsChrome";

/** Tab screens: content area above the bottom nav (the nav hides during an active ride). */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabsChromeProvider>
      <main className="relative min-h-0 flex-1">{children}</main>
      <Suspense fallback={<BottomNavSkeleton />}>
        <BottomNav />
      </Suspense>
    </TabsChromeProvider>
  );
}
