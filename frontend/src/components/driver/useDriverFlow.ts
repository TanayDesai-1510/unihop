"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/app/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { readDriverWatch, removeDriverWatch, saveDriverWatch } from "@/lib/assistant";
import type { DriverProfile, Earnings, Hub, LatLng, Ride, RideOffer, RideStatus } from "@/lib/types";
import { isOfferRevoked } from "@/lib/types";
import { realtime } from "@/lib/ws";
import { useDriverLocation } from "./useDriverLocation";

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

function locateForAssistant(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location access is required before Claude can watch for rides."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Allow location access so Claude can put you online and watch for rides.")),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30_000 },
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
  const [acting, setActing] = useState<"arrived" | "start" | "complete" | "cancel" | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinTries, setPinTries] = useState(0);
  const [rated, setRated] = useState(false);
  const [legStart, setLegStart] = useState<LatLng | null>(null);
  const [watchHubId, setWatchHubId] = useState<string | null>(() => readDriverWatch());
  const lastStatus = useRef<RideStatus | null>(null);
  const assistantHandling = useRef<string | null>(null);
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
        setWatchHubId(null);
        removeDriverWatch();
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
    const offOffers = realtime.subscribeDriverOffers(userId, (e) => {
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
    // An offer sent (or revoked) while the socket was down is never redelivered: re-read it on reconnect.
    let catchUp: ReturnType<typeof setTimeout> | undefined;
    let wasDown = false;
    const offConn = realtime.onConnectionChange((state) => {
      if (state === "disconnected") wasDown = true;
      if (state !== "connected" || !wasDown) return;
      wasDown = false;
      clearTimeout(catchUp);
      catchUp = setTimeout(() => {
        api
          .getCurrentOffer()
          .then((o) => setOffer(o))
          .catch(() => {});
      }, 0);
    });
    return () => {
      clearTimeout(catchUp);
      offOffers();
      offConn();
    };
  }, [userId, toast]);

  // ---- live ride status (rider may cancel) ----
  const rideId = ride?.id;
  useEffect(() => {
    if (!rideId) return;
    const offStatus = realtime.subscribeRideStatus(rideId, (e) => {
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
    // Catch up on anything missed before subscribing or while disconnected (e.g. the rider cancelled).
    let catchUp: ReturnType<typeof setTimeout> | undefined;
    const offConn = realtime.onConnectionChange((state) => {
      if (state !== "connected") return;
      clearTimeout(catchUp);
      catchUp = setTimeout(() => {
        api
          .getRide(rideId)
          .then((r) => {
            if (r.status === "CANCELLED" && lastStatus.current !== "CANCELLED") {
              haptic("error");
              toast.show({ tone: "info", message: "The rider cancelled this trip. You weren't affected." });
            }
            lastStatus.current = r.status;
            setRide(r);
          })
          .catch(() => {});
      }, 0);
    });
    return () => {
      clearTimeout(catchUp);
      offStatus();
      offConn();
    };
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
  const clearAssistantWatch = useCallback(() => {
    setWatchHubId(null);
    removeDriverWatch();
  }, []);

  const startAssistantWatch = useCallback(
    async (dropoffHubId: string) => {
      const destination = hubs.find((hub) => hub.id === dropoffHubId);
      if (!destination) throw new Error("Claude selected an unknown destination.");
      if (!profile || profile.status !== "APPROVED") throw new Error("Finish driver setup before asking Claude to find rides.");
      if (ride) throw new Error("Finish your current ride before starting a destination watch.");
      if (!profile.isOnline) {
        const current = await locateForAssistant();
        setPosition(current);
        setProfile(await api.goOnline(current));
      }
      setWatchHubId(dropoffHubId);
      saveDriverWatch(dropoffHubId);
      toast.show({ tone: "success", message: `Claude is watching for rides to ${destination.name}.` });
    },
    [hubs, profile, ride, toast],
  );

  const stopAssistantWatch = useCallback(() => {
    clearAssistantWatch();
    toast.show({ tone: "info", message: "Claude stopped watching for destination-matched rides." });
  }, [clearAssistantWatch, toast]);

  const toggleOnline = useCallback(async () => {
    if (!profile || toggling) return;
    setToggling(true);
    haptic("tick");
    try {
      if (profile.isOnline) {
        setProfile(await api.goOffline());
        setOffer(null);
        clearAssistantWatch();
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
  }, [profile, toggling, position, toast, clearAssistantWatch]);

  const accept = useCallback(async () => {
    if (!offer || responding) return;
    setResponding("accept");
    try {
      const r = await api.acceptRide(offer.rideId);
      haptic("accepted");
      setLegStart(position);
      lastStatus.current = r.status;
      setRide(r);
      setOffer(null);
      clearAssistantWatch();
    } catch (e) {
      const code = e instanceof ApiRequestError ? e.code : "";
      toast.show({ tone: "info", message: code === "OFFER_NOT_ACTIVE" ? "That offer expired. We'll send you the next one." : "Couldn't accept that trip. Try again." });
      setOffer(null);
    } finally {
      setResponding(null);
    }
  }, [offer, responding, toast, position, clearAssistantWatch]);

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

  useEffect(() => {
    if (!offer || !watchHubId || responding || ride || assistantHandling.current === offer.offerId) return;
    assistantHandling.current = offer.offerId;
    const matches = offer.dropoffHub.id === watchHubId;
    setResponding(matches ? "accept" : "decline");
    const respond = async () => {
      try {
        if (matches) {
          const accepted = await api.acceptRide(offer.rideId);
          haptic("accepted");
          setLegStart(position);
          lastStatus.current = accepted.status;
          setRide(accepted);
          setOffer(null);
          clearAssistantWatch();
          toast.show({ tone: "success", message: `Claude accepted a ride to ${offer.dropoffHub.name}.` });
        } else {
          await api.declineRide(offer.rideId);
          setOffer(null);
        }
      } catch (caught) {
        setOffer(null);
        if (caught instanceof ApiRequestError && caught.code === "OFFER_NOT_ACTIVE") {
          toast.show({ tone: "info", message: "That offer expired. Claude is still watching." });
        } else {
          toast.show({ tone: "error", message: caught instanceof ApiRequestError ? caught.message : "Claude couldn't respond to that offer." });
        }
      } finally {
        assistantHandling.current = null;
        setResponding(null);
      }
    };
    void respond();
  }, [offer, watchHubId, responding, ride, position, clearAssistantWatch, toast]);

  const expire = useCallback(() => {
    setOffer(null);
    toast.show({ tone: "info", message: "Offer expired. Stay online for the next one." });
  }, [toast]);

  // ---- ride actions ----
  const act = useCallback(
    async (kind: "arrived" | "start" | "complete" | "cancel", call: () => Promise<Ride>) => {
      if (acting) return;
      setActing(kind);
      try {
        const r = await call();
        lastStatus.current = r.status;
        setRide(r);
        if (kind === "complete") haptic("success");
        if (kind === "start") setPinError(null);
      } catch (e) {
        if (e instanceof ApiRequestError && e.code === "INVALID_PIN") {
          haptic("error");
          setPinError("That PIN doesn't match. Ask the rider to read it again.");
          setPinTries((n) => n + 1);
        } else {
          toast.show({ tone: "error", message: e instanceof ApiRequestError ? e.message : "Something went wrong. Try again." });
        }
      } finally {
        setActing(null);
      }
    },
    [acting, toast],
  );
  const markArrived = useCallback(() => ride && act("arrived", () => api.markArrived(ride.id)), [ride, act]);
  const startTrip = useCallback((pin: string) => ride && act("start", () => api.startRide(ride.id, pin)), [ride, act]);
  const completeTrip = useCallback(() => ride && act("complete", () => api.completeRide(ride.id)), [ride, act]);
  const cancelTrip = useCallback(() => ride && act("cancel", () => api.cancelRide(ride.id, "Driver cancelled")), [ride, act]);
  const clearPinError = useCallback(() => setPinError(null), []);

  const rate = useCallback(
    async (stars: 1 | 2 | 3 | 4 | 5) => {
      if (!ride || rated) return;
      try {
        await api.rateRide(ride.id, { stars });
        setRated(true);
      } catch (e) {
        if (e instanceof ApiRequestError && e.code === "ALREADY_RATED") setRated(true);
        else toast.show({ tone: "error", message: "Couldn't save your rating. Try again." });
      }
    },
    [ride, rated, toast],
  );

  // ---- where the car is during the ride ----
  const leg = ride?.status === "ACCEPTED" ? "pickup" : ride?.status === "IN_PROGRESS" ? "trip" : null;
  const legFrom = leg === "trip" && ride ? { lat: ride.pickupHub.lat, lng: ride.pickupHub.lng } : legStart ?? position;
  const legTo = ride ? (leg === "trip" ? { lat: ride.dropoffHub.lat, lng: ride.dropoffHub.lng } : { lat: ride.pickupHub.lat, lng: ride.pickupHub.lng }) : null;
  const onMove = useCallback((p: LatLng) => setPosition(p), []);
  const { demo: demoGps } = useDriverLocation({ leg, from: legFrom, to: legTo, onMove });

  const finish = useCallback(() => {
    setRide(null);
    setRated(false);
    setLegStart(null);
    setPinError(null);
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

  const watchedHub = hubs.find((hub) => hub.id === watchHubId) ?? null;

  return useMemo(
    () => ({
      phase, profile, hubs, earnings, position, toggling, offer, responding, ride, setRide, toggleOnline, accept, decline, expire, finish,
      watchedHub, startAssistantWatch, stopAssistantWatch,
      acting, pinError, pinTries, clearPinError, rated, demoGps, markArrived, startTrip, completeTrip, cancelTrip, rate,
    }),
    [phase, profile, hubs, earnings, position, toggling, offer, responding, ride, toggleOnline, accept, decline, expire, finish, watchedHub, startAssistantWatch, stopAssistantWatch, acting, pinError, pinTries, clearPinError, rated, demoGps, markArrived, startTrip, completeTrip, cancelTrip, rate],
  );
}

export type DriverFlowState = ReturnType<typeof useDriverFlow>;
