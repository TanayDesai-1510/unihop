// Route geometry for the map: road-following routes (OSRM public demo server, no key) with a
// smooth curved fallback, plus helpers to place the car along the drawn route by progress.
// Pure functions + one cached fetch; no Leaflet import, so this is safe to import anywhere.

export type LatLng = [number, number];

const cache = new Map<string, Promise<LatLng[]>>();
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const TIMEOUT_MS = 2500;

/** Road route between two points; falls back to a gentle curve if routing is slow or offline. */
export function fetchRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  const key = `${from.join(",")}>${to.join(",")}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
          const res = await fetch(`${OSRM}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`, { signal: ctrl.signal });
          clearTimeout(t);
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { routes?: Array<{ geometry: { coordinates: [number, number][] } }> };
          const coords = data.routes?.[0]?.geometry.coordinates;
          if (!coords || coords.length < 2) throw new Error("no route");
          return coords.map(([lng, lat]) => [lat, lng] as LatLng);
        } catch {
          return curve(from, to);
        }
      })(),
    );
  }
  return cache.get(key)!;
}

/** Quadratic curve between two points, bowed slightly to one side. */
export function curve(from: LatLng, to: LatLng, bow = 0.18, steps = 32): LatLng[] {
  const mid: LatLng = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const dx = to[1] - from[1];
  const dy = to[0] - from[0];
  const ctrl: LatLng = [mid[0] - dx * bow, mid[1] + dy * bow];
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    pts.push([a * from[0] + b * ctrl[0] + c * to[0], a * from[1] + b * ctrl[1] + c * to[1]]);
  }
  return pts;
}

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point and heading at fraction t (0..1) of a polyline's length. */
export function pointAlong(route: LatLng[], t: number): { at: LatLng; heading: number } {
  if (route.length < 2) return { at: route[0], heading: 0 };
  const segs = route.slice(1).map((p, i) => haversine(route[i], p));
  const total = segs.reduce((s, d) => s + d, 0) || 1;
  let target = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(target / segs[i], 1) : 0;
      const a = route[i], b = route[i + 1];
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: bearing(a, b) };
    }
    target -= segs[i];
  }
  return { at: route[route.length - 1], heading: 0 };
}

/**
 * Fraction (0..1) of the way from `start` to `end` that `p` has travelled, measured along the
 * straight line between them. The simulator moves linearly, so this maps its reported position
 * onto the drawn road route ("snap to road" by progress).
 */
export function progressBetween(start: LatLng, end: LatLng, p: LatLng): number {
  const vx = end[1] - start[1], vy = end[0] - start[0];
  const wx = p[1] - start[1], wy = p[0] - start[0];
  const len2 = vx * vx + vy * vy;
  if (!len2) return 1;
  return Math.min(Math.max((wx * vx + wy * vy) / len2, 0), 1);
}
