import { ConnectionBanner } from "@/components/app/ConnectionBanner";
import { SessionGate } from "@/components/app/SessionGate";
import { SessionProvider } from "@/components/app/SessionProvider";

/** Every signed-in screen: session, reconnecting banner. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConnectionBanner />
      <SessionGate>{children}</SessionGate>
    </SessionProvider>
  );
}
