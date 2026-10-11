import { Hammer } from "lucide-react";
import { Screen } from "@/components/app/Screen";
import { EmptyState } from "@/components/ui/States";

/** Placeholder for screens not built yet. Replace the page body when its issue is picked up. */
export function RouteStub({ title, issue, detail }: { title: string; issue: number; detail?: string }) {
  return (
    <Screen title={title} subtitle={detail}>
      <EmptyState icon={<Hammer aria-hidden size={24} strokeWidth={2} />} title="Not built yet" message={`This screen ships with issue #${issue}.`} />
    </Screen>
  );
}
