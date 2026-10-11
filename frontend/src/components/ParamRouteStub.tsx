"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "./RouteStub";

/** RouteStub for dynamic routes. Must be rendered inside <Suspense> (Cache Components). */
export function ParamRouteStub({ title, issue }: { title: string; issue: string }) {
  const { id } = useParams<{ id: string }>();
  return <RouteStub title={title} issue={issue} detail={`id: ${id}`} />;
}
