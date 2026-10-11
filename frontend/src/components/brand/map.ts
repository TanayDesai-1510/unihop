// UniHop map styling for Leaflet (DESIGN.md section 2): route like the logo's road, navy hub pins,
// logo-icon pins for the selected pickup/dropoff, accent live car.
//
// Leaflet touches `window`: import this module only from components loaded with
// next/dynamic({ ssr: false }). Colors come from CSS classes in globals.css, never inline hex,
// so light and dark mode both follow the tokens.
import L from "leaflet";

/**
 * Neutral gray basemaps (no API key) so navy and orange carry the brand: Esri Light/Dark Gray Canvas.
 * (CARTO's free basemaps now return "API key required" tiles.)
 */
export const TILES = {
  light: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
  maxZoom: 16,
} as const;

export function prefersDark(): boolean {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return true;
  if (forced === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Route polylines: draw the casing first, then the lane on top. */
export const routeCasingStyle: L.PolylineOptions = {
  className: "unihop-route-casing",
  weight: 9,
  opacity: 1,
  lineCap: "round",
  lineJoin: "round",
  interactive: false,
};

export const routeStyle: L.PolylineOptions = {
  className: "unihop-route",
  weight: 5,
  opacity: 1,
  lineCap: "round",
  lineJoin: "round",
  interactive: false,
};

/** Adds the two-layer route to a map and returns both layers (remove them together). */
export function addRoute(map: L.Map, points: L.LatLngExpression[]): L.Polyline[] {
  return [L.polyline(points, routeCasingStyle).addTo(map), L.polyline(points, routeStyle).addTo(map)];
}

/** Small navy pin for unselected hubs. */
export function hubIcon(): L.DivIcon {
  return L.divIcon({
    className: "unihop-hub-pin",
    iconSize: [22, 28],
    iconAnchor: [11, 27],
    html: `<svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true"><path d="M11 27c-.6 0-1-.3-1.4-.8C5.6 21 1 15.6 1 10.6 1 5 5.5 1 11 1s10 4 10 9.6c0 5-4.6 10.4-8.6 15.6-.4.5-.8.8-1.4.8Z" style="fill:var(--brand);stroke:var(--route-casing);stroke-width:2"/><circle cx="11" cy="10.5" r="3.5" style="fill:var(--route-casing)"/></svg>`,
  });
}

/**
 * Selected pickup/dropoff: the actual logo icon in a light container with a pointer
 * (never the navy icon directly on the map, per DESIGN.md section 2). `pulsing` adds the
 * finding-driver accent ring.
 */
export function selectedIcon({ pulsing = false, label }: { pulsing?: boolean; label?: string } = {}): L.DivIcon {
  return L.divIcon({
    className: `unihop-selected-pin${pulsing ? " is-pulsing" : ""}`,
    iconSize: [44, 51],
    iconAnchor: [22, 51],
    html: `<div class="pin" role="img" aria-label="${label ?? "Selected hub"}"><img src="/brand/icon-192.png" alt="" draggable="false"/></div>`,
  });
}

/** Live car marker in accent; rotate the inner element to the heading (degrees clockwise from north). */
export function carIcon(heading = 0): L.DivIcon {
  return L.divIcon({
    className: "unihop-car",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="car" style="transform:rotate(${Math.round(heading)}deg)"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 19.5 20.6c.2.5-.3 1-.8.7L12 18l-6.7 3.3c-.5.3-1-.2-.8-.7Z"/></svg></div>`,
  });
}

/** Updates a car marker's heading without re-creating the icon (keeps the CSS rotation transition). */
export function setCarHeading(marker: L.Marker, heading: number): void {
  const el = marker.getElement()?.querySelector<HTMLElement>(".car");
  if (el) el.style.transform = `rotate(${Math.round(heading)}deg)`;
}
