import { Screen } from "@/components/app/Screen";
import { RoadScene, type RoadSceneVariant } from "@/components/brand/RoadScene";
import { EmptyState } from "@/components/ui/States";

/** Placeholder for screens not built yet. Replace the page body when its issue is picked up. */
export function RouteStub({ title, issue, detail, scene = "pin", headline = "Coming soon" }: { title: string; issue: number; detail?: string; scene?: RoadSceneVariant; headline?: string }) {
  return (
    <Screen title={title} subtitle={detail}>
      <EmptyState illustration={<RoadScene variant={scene} />} title={headline} message={`This screen ships with issue #${issue}.`} className="pt-6" />
    </Screen>
  );
}
