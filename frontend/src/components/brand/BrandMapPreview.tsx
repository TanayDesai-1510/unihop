"use client";

// Client-only (Leaflet): load with next/dynamic({ ssr: false }).
import L from "leaflet";
import { useEffect, useRef } from "react";
import { HUBS } from "@/mocks/data";
import { addRoute, carIcon, hubIcon, prefersDark, selectedIcon, TILES, tileOptions } from "./map";

/** Demo route from The Yard toward Cook Campus Center (illustrative waypoints, not turn-by-turn). */
const ROUTE: L.LatLngExpression[] = [
  [40.4998, -74.4479],
  [40.4979, -74.4462],
  [40.4951, -74.4447],
  [40.4921, -74.4412],
  [40.4889, -74.4391],
  [40.4853, -74.4378],
  [40.4822, -74.4366],
  [40.4797, -74.4362],
];

/** Map styling showcase for /dev/components: hub pins, selected pins, route, live car. */
export default function BrandMapPreview() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView([40.4925, -74.4425], 14);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    let tiles = L.tileLayer(prefersDark() ? TILES.dark : TILES.light, tileOptions).addTo(map);

    const pickup = HUBS.find((h) => h.code === "YARD")!;
    const dropoff = HUBS.find((h) => h.code === "COOK_CC")!;
    for (const h of HUBS) {
      if (h.id === pickup.id || h.id === dropoff.id) continue;
      L.marker([h.lat, h.lng], { icon: hubIcon(), title: h.name, keyboard: false }).addTo(map);
    }
    addRoute(map, ROUTE);
    L.marker([pickup.lat, pickup.lng], { icon: selectedIcon({ pulsing: true, label: `Pickup: ${pickup.name}` }), keyboard: false }).addTo(map);
    L.marker([dropoff.lat, dropoff.lng], { icon: selectedIcon({ label: `Dropoff: ${dropoff.name}` }), keyboard: false }).addTo(map);
    L.marker([40.4921, -74.4412], { icon: carIcon(140), keyboard: false }).addTo(map);
    map.fitBounds(L.latLngBounds(ROUTE).pad(0.35));

    // Follow the /dev/components theme switch and OS changes.
    const swap = () => {
      map.removeLayer(tiles);
      tiles = L.tileLayer(prefersDark() ? TILES.dark : TILES.light, tileOptions).addTo(map);
      tiles.bringToBack();
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", swap);
    window.addEventListener("unihop:theme", swap);
    return () => {
      mq.removeEventListener("change", swap);
      window.removeEventListener("unihop:theme", swap);
      map.remove();
    };
  }, []);

  return <div ref={ref} role="img" aria-label="Map styling preview: route from The Yard to Cook Campus Center" className="h-full w-full" />;
}
