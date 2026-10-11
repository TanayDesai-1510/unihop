"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/app/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import type { DriverProfile, Earnings, Hub, LatLng, Ride, RideOffer, RideStatus } from "@/lib/types";
import { isOfferRevoked } from "@/lib/types";
import { realtime } from "@/lib/ws";

export type DriverPhase = "loading" | "not-driver" | "offline" | "online" | "offer" | "pickup" | "arrived" | "trip" | "done" | "ended";

const HEARTBEAT_MS = 10_000;
const YARD: LatLng = { lat: 40.4998, lng: -74.4479 };

function rideStatusPhase(s: RideStatus): DriverPhase {
  switch (s) {
    case "ACCEPTED":
      return "pickup";
    case "ARRIVED":
      return "arrived";
    case "IN_PROGRESS":
      return "trip";
    case "COMPLETED":
      return "done";
    default:
      return "ended";
  }
}

/** Best-effort current position: GPS if allowed (3s), else the last known profile spot, else The Yard. */
function locate(fallback: LatLng | null): Promise<LatLng> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(fallback ?? YARD);
    const t = setTimeout(() => resolve(fallback ?? YARD), 3000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        clearTimeout(t);
        resolve(fallback ?? YARD);
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 30_000 },
    );
  });
}

/** Driver-side state and actions. The UI is a pure function of this; logic lives in api/ws. */
export function useDriverFlow({ initialRideId }: { initialRideId?: string } = {}) {
  const toast = useToast();
  const { user } = useSession();
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [toggling, setToggling] = useState(false);
  const [offer, setOffer] = useState<RideOffer | null>(null);
  const [responding, setResponding] = useState<"accept" | "decline" | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const lastStatus = useRef<RideStatus | null>(null);
  const userId = user?.id;

  // ---- load profile, hubs, earnings, any active ride or live offer ----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .getMyDriverProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        if (p.lat != null && p.lng != null) setPosition({ lat: p.lat, lng: p.lng });
      })
      .catch(() => !cancelled && setProfile(null)); // 404: not onboarded yet
    api.getHubs().then((h) => !cancelled && setHubs(h)).catch(() => {});
    api.getEarnings().then((e) => !cancelled && setEarnings(e)).catch(() => {});
    (initialRideId ? api.getRide(initialRideId) : api.getActiveRide())
      .then((r) => {
        if (cancelled || !r || r.driver?.id !== userId) return;
        lastStatus.current = r.status;
        setRide(r);
      })
      .catch(() => {});
    api
      .getCurrentOffer()
      .then((o) => !cancelled && o && setOffer(o))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, initialRideId]);

  // ---- offers over WebSocket ----
  useEffect(() => {
    if (!userId) return;
    return realtime.subscribeDriverOffers(userId, (e) => {
      if (isOfferRevoked(e)) {
        setOffer((o) => {
          if (o && o.offerId === e.offerId) toast.show({ tone: "info", message: "The rider cancelled that request." });
          return o && o.offerId === e.offerId ? null : o;
        });
        return;
      }
      haptic("offer");
      setOffer(e);
    });
  }, [userId, toast]);

  // ---- live ride status (rider may cancel) ----
  const rideId = ride?.id;
  useEffect(() => {
    if (!rideId) return;
    return realtime.subscribeRideStatus(rideId, (e) => {
      if (e.status !== lastStatus.current) {
        if (e.status === "CANCELLED" && lastStatus.current !== "CANCELLED") {
          haptic("error");
          toast.show({ tone: "info", message: "The rider cancelled this trip. You weren't affected." });
        }
        lastStatus.current = e.status;
      }
      setRide((r) => (r ? { ...r, status: e.status } : r));
      api.getRide(rideId).then(setRide).catch(() => {});
    });
  }, [rideId, toast]);

  // ---- location heartbeat while online (matching uses it) ----
  const online = !!profile?.isOnline;
  useEffect(() => {
    if (!online || !position) return;
    const t = setInterval(() => {
      api.updateLocation(position).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [online, position]);

  // ---- actions ----
  const toggleOnline = useCallback(async () => {
    if (!profile || toggling) return;
    setToggling(true);
    haptic("tick");
    try {
      if (profile.isOnline) {
        setProfile(await api.goOffline());
        setOffer(null);
      } else {
        const pos = await locate(position);
        setPosition(pos);
        setProfile(await api.goOnline(pos));
      }
    } catch (e) {
      toast.show({ tone: "error", message: e instanceof ApiRequestError ? e.message : "Couldn't change your status. Try again." });
    } finally {
      setToggling(false);
    }
  }, [profile, toggling, position, toast]);

  const accept = useCallback(async () => {
    if (!offer || responding) return;
    setResponding("accept");
    try {
      const r = await api.acceptRide(offer.rideId);
      haptic("accepted");
      lastStatus.current = r.status;
      setRide(r);
      setOffer(null);
    } catch (e) {
      const code = e instanceof ApiRequestError ? e.code : "";
      toast.show({ tone: "info", message: code === "OFFER_NOT_ACTIVE" ? "That offer expired. We'll send you the next one." : "Couldn't accept that trip. Try again." });
      setOffer(null);
    } finally {
      setResponding(null);
    }
  }, [offer, responding, toast]);

  const decline = useCallback(async () => {
    if (!offer || responding) return;
    setResponding("decline");
    try {
      await api.declineRide(offer.rideId);
    } catch {
      // expired or revoked meanwhile: nothing to undo
    } finally {
      setOffer(null);
      setResponding(null);
    }
  }, [offer, responding]);

  const expire = useCallback(() => {
    setOffer(null);
    toast.show({ tone: "info", message: "Offer expired. Stay online for the next one." });
  }, [toast]);

  const finish = useCallback(() => {
    setRide(null);
    lastStatus.current = null;
    api.getEarnings().then(setEarnings).catch(() => {});
    api.getMyDriverProfile().then(setProfile).catch(() => {});
  }, []);

  let phase: DriverPhase;
  if (ride) phase = rideStatusPhase(ride.status);
  else if (profile === undefined) phase = "loading";
  else if (profile === null || profile.status !== "APPROVED") phase = "not-driver";
  else if (offer) phase = "offer";
  else phase = profile.isOnline ? "online" : "offline";

  return useMemo(
    () => ({ phase, profile, hubs, earnings, position, toggling, offer, responding, ride, setRide, toggleOnline, accept, decline, expire, finish }),
    [phase, profile, hubs, earnings, position, toggling, offer, responding, ride, toggleOnline, accept, decline, expire, finish],
  );
}

export type DriverFlowState = ReturnType<typeof useDriverFlow>;
