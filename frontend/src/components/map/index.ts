"use client";

import dynamic from "next/dynamic";
import { createElement } from "react";

export type { MapPhase, RideMapProps } from "./RideMap";

/** The ride map, client-only (Leaflet needs window). Shows a calm surface while it loads. */
export const RideMap = dynamic(() => import("./RideMap"), {
  ssr: false,
  loading: () => createElement("div", { className: "absolute inset-0 bg-surface", "aria-hidden": true }),
});
