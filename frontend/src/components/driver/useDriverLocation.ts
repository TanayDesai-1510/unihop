"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRoute, pointAlong, type LatLng as Pt } from "@/components/map/route";
import { api } from "@/lib/api";
import type { LatLng } from "@/lib/types";

const SEND_EVERY_MS = 2000;
const GPS_GRACE_MS = 5000;
/** Demo drive durations: long enough to watch, short enough for a judge. */
const DEMO_LEG_MS = { pickup: 20_000, trip: 26_000 } as const;

/**
 * Driver position during a ride, reported to the backend every 2s (contract: POST
 * /api/drivers/me/location; the server broadcasts it to the rider).
 *
 * Real GPS when the browser gives a fix. If there's no fix within 5s (laptop, permission denied,
 * or phones standing still at a demo table), the app drives the route itself at a steady pace and
 * reports that instead, flagged as demo GPS. The backend's simulator never drives real drivers,
 * so without this the rider's car would sit still.
 */
export function useDriverLocation({
  leg,
  from,
  to,
  onMove,
}: {
  /** Which leg we're driving, or null when not moving (offline, waiting, at pickup). */
  leg: "pickup" | "trip" | null;
  from: LatLng | null;
  to: LatLng | null;
  onMove: (p: LatLng) => void;
}) {
  const [demo, setDemo] = useState(false);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const fromKey = from ? `${from.lat.toFixed(5)},${from.lng.toFixed(5)}` : "";
  const toKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : "";

  useEffect(() => {
    if (!leg || !from || !to) return;
    let cancelled = false;
    let lastSent = 0;
    let watchId: number | null = null;
    let demoTimer: ReturnType<typeof setInterval> | null = null;
    let gotFix = false;

    const report = (p: LatLng) => {
      onMoveRef.current(p);
      const now = Date.now();
      if (now - lastSent >= SEND_EVERY_MS - 50) {
        lastSent = now;
        api.updateLocation(p).catch(() => {});
      }
    };

    const startDemo = async () => {
      if (cancelled) return;
      setDemo(true);
      const route = await fetchRoute([from.lat, from.lng], [to.lat, to.lng]);
      if (cancelled) return;
      const t0 = Date.now();
      const step = () => {
        const k = Math.min((Date.now() - t0) / DEMO_LEG_MS[leg], 0.985);
        const { at } = pointAlong(route as Pt[], k);
        report({ lat: at[0], lng: at[1] });
        if (k >= 0.985 && demoTimer) clearInterval(demoTimer);
      };
      step();
      demoTimer = setInterval(step, SEND_EVERY_MS);
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          gotFix = true;
          report({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          if (!gotFix) startDemo();
        },
        { enableHighAccuracy: true, maximumAge: 2000 },
      );
    }
    const grace = setTimeout(() => {
      if (!gotFix && !demoTimer) startDemo();
    }, GPS_GRACE_MS);

    return () => {
      cancelled = true;
      clearTimeout(grace);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (demoTimer) clearInterval(demoTimer);
      setDemo(false);
    };
    // re-run per leg and per endpoint, not per position update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg, fromKey, toKey]);

  return { demo };
}
