"use client";

// Client-only (Leaflet): load with next/dynamic({ ssr: false }). See components/map/index.ts.
import L from "leaflet";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { carIcon, hubIcon, prefersDark, routeCasingStyle, routeStyle, selectedIcon, setCarHeading, TILES, tileOptions } from "@/components/brand/map";
import { springHop, springSnappy } from "@/lib/motion";
import type { Hub } from "@/lib/types";
import { fetchRoute, pointAlong, progressBetween, type LatLng } from "./route";

export type MapPhase = "browse" | "options" | "confirm" | "matching" | "enroute" | "trip" | "done";

export interface RideMapProps {
  hubs: Hub[];
  pickupId?: string | null;
  dropoffId?: string | null;
  phase: MapPhase;
  /** Last reported driver position (enroute / trip). */
  driver?: { lat: number; lng: number; heading?: number } | null;
  /** Pixels of the map covered by the sheet at its current detent (camera padding). */
  bottomInset: number;
  /** Confirm phase: the map was dragged under the fixed pin and snapped to this hub. */
  onPickupSnap?: (hubId: string) => void;
  onHubTap?: (hubId: string) => void;
}

const TOP_INSET = 148; // floating top bar + attribution + the selected pin graphic (51px above its point)
const CAR_GLIDE_MS = 1300;

const ll = (h: Hub): LatLng => [h.lat, h.lng];

export default function RideMap({ hubs, pickupId, dropoffId, phase, driver, bottomInset, onPickupSnap, onHubTap }: RideMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const hubLayer = useRef<L.LayerGroup | null>(null);
  const routeLayers = useRef<L.Polyline[]>([]);
  const routePts = useRef<LatLng[] | null>(null);
  const legStart = useRef<LatLng | null>(null);
  const car = useRef<L.Marker | null>(null);
  const carAnim = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const insetRef = useRef(bottomInset);
  useEffect(() => {
    insetRef.current = bottomInset;
  }, [bottomInset]);

  const pickup = hubs.find((h) => h.id === pickupId) ?? null;
  const dropoff = hubs.find((h) => h.id === dropoffId) ?? null;

  // ---- create once ----
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, zoomSnap: 0.25, fadeAnimation: true }).setView([40.5005, -74.446], 14);
    // Attribution top-right under the floating bar: always visible, never under the sheet.
    L.control.attribution({ position: "topright", prefix: '<a href="https://leafletjs.com">Leaflet</a>' }).addTo(m);
    tiles.current = L.tileLayer(prefersDark() ? TILES.dark : TILES.light, tileOptions).addTo(m);
    hubLayer.current = L.layerGroup().addTo(m);
    map.current = m;

    const swap = () => {
      if (!tiles.current) return;
      m.removeLayer(tiles.current);
      tiles.current = L.tileLayer(prefersDark() ? TILES.dark : TILES.light, tileOptions).addTo(m);
      tiles.current.bringToBack();
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", swap);
    window.addEventListener("unihop:theme", swap);
    const ro = new ResizeObserver(() => m.invalidateSize({ pan: false }));
    ro.observe(el.current);
    return () => {
      mq.removeEventListener("change", swap);
      window.removeEventListener("unihop:theme", swap);
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // ---- hub pins ----
  useEffect(() => {
    const layer = hubLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const activeRide = phase === "enroute" || phase === "trip" || phase === "matching" || phase === "done";
    for (const h of hubs) {
      const isPickup = h.id === pickupId;
      const isDropoff = h.id === dropoffId;
      if (isPickup && phase === "confirm") continue; // the fixed center pin stands in for it
      if (isPickup || isDropoff) {
        const icon = selectedIcon({ pulsing: isPickup && phase === "matching", label: `${isPickup ? "Pickup" : "Dropoff"}: ${h.name}` });
        L.marker(ll(h), { icon, keyboard: false, zIndexOffset: 500 }).addTo(layer);
      } else if (!activeRide) {
        const m = L.marker(ll(h), { icon: hubIcon(), title: h.name, keyboard: false });
        if (onHubTap) m.on("click", () => onHubTap(h.id));
        m.addTo(layer);
      }
    }
  }, [hubs, pickupId, dropoffId, phase, onHubTap]);

  // ---- route (draws itself in) ----
  const routeKey =
    phase === "enroute" ? `enroute:${pickupId}` : phase === "trip" || phase === "done" || phase === "options" || phase === "confirm" || phase === "matching" ? `ride:${pickupId}>${dropoffId}` : "none";
  const driverKnown = !!driver;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    routeLayers.current.forEach((l) => l.remove());
    routeLayers.current = [];
    routePts.current = null;
    if (routeKey === "none" || !pickup) return;
    let from: LatLng, to: LatLng;
    if (phase === "enroute") {
      if (!driver) return;
      from = [driver.lat, driver.lng];
      to = ll(pickup);
    } else {
      if (!dropoff) return;
      from = ll(pickup);
      to = ll(dropoff);
    }
    legStart.current = from;
    let cancelled = false;
    fetchRoute(from, to).then((pts) => {
      if (cancelled || !map.current) return;
      routePts.current = pts;
      const casing = L.polyline(pts, routeCasingStyle).addTo(m);
      const lane = L.polyline(pts, routeStyle).addTo(m);
      routeLayers.current = [casing, lane];
      if (!reduce) for (const line of [casing, lane]) drawIn(line);
    });
    return () => {
      cancelled = true;
    };
    // driver position only matters for the first enroute fix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, pickup?.id, dropoff?.id, driverKnown]);

  // ---- car marker: glides between fixes, snapped to the drawn route ----
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!driver || !(phase === "enroute" || phase === "trip")) {
      car.current?.remove();
      car.current = null;
      return;
    }
    let target: LatLng = [driver.lat, driver.lng];
    let heading = driver.heading ?? 0;
    const pts = routePts.current;
    const end: LatLng | null = phase === "enroute" && pickup ? ll(pickup) : phase === "trip" && dropoff ? ll(dropoff) : null;
    if (pts && legStart.current && end) {
      const along = pointAlong(pts, progressBetween(legStart.current, end, target));
      target = along.at;
      heading = along.heading;
    }
    if (!car.current) {
      car.current = L.marker(target, { icon: carIcon(heading), keyboard: false, zIndexOffset: 1000, interactive: false }).addTo(m);
      return;
    }
    const marker = car.current;
    setCarHeading(marker, heading);
    if (carAnim.current) cancelAnimationFrame(carAnim.current);
    const from = marker.getLatLng();
    if (reduce) {
      marker.setLatLng(target);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min((now - t0) / CAR_GLIDE_MS, 1);
      const e = 1 - Math.pow(1 - k, 3);
      marker.setLatLng([from.lat + (target[0] - from.lat) * e, from.lng + (target[1] - from.lng) * e]);
      if (k < 1) carAnim.current = requestAnimationFrame(step);
    };
    carAnim.current = requestAnimationFrame(step);
  }, [driver, phase, pickup, dropoff, reduce]);

  // ---- camera: refit on every state change ----
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts: LatLng[] = [];
    if (phase === "browse" || (!pickup && !dropoff)) hubs.forEach((h) => pts.push(ll(h)));
    if (phase === "confirm" && pickup) {
      centerOnVisual(m, ll(pickup), 16, insetRef.current, !reduce);
      return;
    }
    if (pickup && phase !== "trip") pts.push(ll(pickup));
    if (dropoff && phase !== "enroute") pts.push(ll(dropoff));
    if (driver && (phase === "enroute" || phase === "trip")) pts.push([driver.lat, driver.lng]);
    if (phase === "matching" && pickup) {
      centerOnVisual(m, ll(pickup), 15.5, insetRef.current, !reduce);
      return;
    }
    if (!pts.length) return;
    const bounds = L.latLngBounds(pts);
    const opts: L.FitBoundsOptions = { paddingTopLeft: [40, TOP_INSET], paddingBottomRight: [40, insetRef.current + 24], maxZoom: 15.5 };
    // Animated fitBounds uses Leaflet's CSS-transform zoom animation (compositor), unlike flyTo,
    // which re-runs setView every frame and drops frames on slow phones.
    m.fitBounds(bounds, { ...opts, animate: !reduce, duration: 0.6 });
    // Re-fit on state changes only (phase, selection, first driver fix). Not on sheet detent moves:
    // a camera flight during a sheet drag costs frames; the current inset is read from insetRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pickup?.id, dropoff?.id, hubs.length, driverKnown]);

  // ---- confirm pickup: drag the map under a fixed pin, snap to the nearest hub ----
  useEffect(() => {
    const m = map.current;
    if (!m || phase !== "confirm") return;
    // dragstart/dragend fire only for user drags, never for the programmatic snap below.
    const start = () => setDragging(true);
    const end = () => {
      const size = m.getSize();
      const visual = m.containerPointToLatLng([size.x / 2, (size.y - insetRef.current) / 2]);
      let best: Hub | null = null;
      let bestD = Infinity;
      for (const h of hubs) {
        const d = visual.distanceTo([h.lat, h.lng]);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      setDragging(false);
      if (!best) return;
      centerOnVisual(m, ll(best), m.getZoom(), insetRef.current, !reduce);
      onPickupSnap?.(best.id);
    };
    m.on("dragstart", start);
    m.on("dragend", end);
    return () => {
      m.off("dragstart", start);
      m.off("dragend", end);
    };
  }, [phase, hubs, onPickupSnap, reduce]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="absolute inset-0" aria-label="Map" role="application" />
      {phase === "confirm" && (
        // Fixed pickup pin at the visual center (above the sheet): lifts while dragging, drops with a hop.
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-center" style={{ bottom: bottomInset }}>
          <div className="relative flex flex-col items-center justify-end" style={{ height: "50%" }}>
            {/* Ground shadow under the pin tip: shrinks and fades as the pin lifts. */}
            <motion.span
              aria-hidden
              className="absolute -bottom-1 h-1.5 w-5 rounded-full bg-scrim"
              animate={dragging ? { opacity: 0.12, scale: 1.6 } : { opacity: 0.28, scale: 1 }}
              transition={springSnappy}
            />
            <motion.div
              animate={dragging ? { y: -14, scale: 1.04 } : { y: 0, scale: 1 }}
              transition={dragging ? springSnappy : springHop}
              className="unihop-selected-pin"
            >
              <div className="pin" role="img" aria-label="Pickup pin">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/icon-192.png" alt="" draggable={false} />
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pan/zoom so `at` sits in the middle of the area above the sheet. */
function centerOnVisual(m: L.Map, at: LatLng, zoom: number, inset: number, animate: boolean) {
  const p = m.project(at, zoom).add([0, inset / 2]);
  const center = m.unproject(p, zoom);
  m.setView(center, zoom, { animate, duration: 0.6 });
}

/** Draws a polyline in from start to end (stroke-dash reveal), then clears the dash. */
function drawIn(line: L.Polyline) {
  const path = line.getElement() as SVGPathElement | undefined;
  if (!path || typeof path.getTotalLength !== "function") return;
  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
  path.getBoundingClientRect();
  path.style.transition = "stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1)";
  path.style.strokeDashoffset = "0";
  setTimeout(() => {
    path.style.transition = "";
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
  }, 950);
}
