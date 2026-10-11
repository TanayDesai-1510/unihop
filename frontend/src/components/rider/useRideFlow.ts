"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { haversine } from "@/components/map/route";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import type { DeclineCode, FareBreakdown, Hub, PaymentMethod, Ride, RideStatus } from "@/lib/types";
import { realtime } from "@/lib/ws";

export type RiderPhase = "home" | "options" | "confirm" | "matching" | "enroute" | "trip" | "done" | "ended";

export interface RequestError {
  code: string;
  message: string;
  declineCode?: DeclineCode;
}

const DECLINE_COPY: Record<DeclineCode, string> = {
  CARD_DECLINED: "Your card was declined. Try another payment method.",
  INSUFFICIENT_FUNDS: "Your card has insufficient funds. Try another payment method.",
  EXPIRED_CARD: "Your card has expired. Try another payment method.",
  INCORRECT_CVC: "Your card's security code didn't match. Try another payment method.",
};

/**
 * Pre-request pickup estimate. The contract has no "nearest driver ETA" endpoint yet, so this is a
 * labelled estimate (minutes). Drop-off time adds a distance-based trip estimate.
 */
export const PICKUP_ESTIMATE_MIN = 3;
const AVG_SPEED_MPS = 7; // campus driving incl. stops

export function tripEstimateSeconds(a: Hub, b: Hub): number {
  return Math.round(haversine([a.lat, a.lng], [b.lat, b.lng]) / AVG_SPEED_MPS + 60);
}

export function clockAt(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function phaseFor(status: RideStatus): RiderPhase {
  switch (status) {
    case "REQUESTED":
      return "matching";
    case "ACCEPTED":
    case "ARRIVED":
      return "enroute";
    case "IN_PROGRESS":
      return "trip";
    case "COMPLETED":
      return "done";
    default:
      return "ended";
  }
}

/** All rider-flow state and actions; the UI is a pure function of this. Logic lives in api/ws. */
export function useRideFlow({ initialRideId }: { initialRideId?: string } = {}) {
  const toast = useToast();
  const [hubs, setHubs] = useState<Hub[] | null>(null);
  const [hubsError, setHubsError] = useState(false);
  const [step, setStep] = useState<"home" | "options" | "confirm">("home");
  const [pickupId, setPickupId] = useState<string | null>(null);
  const [dropoffId, setDropoffId] = useState<string | null>(null);
  const [quote, setQuote] = useState<FareBreakdown | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [useCredits, setUseCredits] = useState(true);
  const [ride, setRide] = useState<Ride | null>(null);
  const [resuming, setResuming] = useState(true);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; heading?: number } | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [rated, setRated] = useState(false);
  const lastStatus = useRef<RideStatus | null>(null);

  // ---- hubs + resume an active ride ----
  const fetchHubs = useCallback(() => {
    api
      .getHubs()
      .then((h) => {
        setHubs(h);
        setPickupId((p) => p ?? (h.find((x) => x.code === "YARD") ?? h[0])?.id ?? null);
      })
      .catch(() => setHubsError(true));
  }, []);
  const loadHubs = useCallback(() => {
    setHubsError(false);
    fetchHubs();
  }, [fetchHubs]);

  const adoptRide = useCallback((r: Ride) => {
    setRide(r);
    setPickupId(r.pickupHub.id);
    setDropoffId(r.dropoffHub.id);
    setRequestedAt(Date.parse(r.requestedAt));
    lastStatus.current = r.status;
    if (r.driver?.lat != null && r.driver.lng != null) setDriverPos({ lat: r.driver.lat, lng: r.driver.lng });
  }, []);

  useEffect(() => {
    fetchHubs();
    const resume = initialRideId ? api.getRide(initialRideId) : api.getActiveRide();
    resume
      .then((r) => {
        // Resume anything still in progress; a deep link shows its ride whatever the state.
        if (r && (initialRideId || (phaseFor(r.status) !== "ended" && r.status !== "COMPLETED"))) adoptRide(r);
      })
      .catch(() => {})
      .finally(() => setResuming(false));
  }, [fetchHubs, adoptRide, initialRideId]);

  // ---- quote whenever the trip changes ----
  useEffect(() => {
    if (!pickupId || !dropoffId || pickupId === dropoffId || ride) return;
    let cancelled = false;
    api
      .quoteFare(pickupId, dropoffId)
      .then((q) => !cancelled && setQuote(q))
      .catch((e: unknown) => {
        if (!cancelled) toast.show({ tone: "error", message: e instanceof ApiRequestError ? e.message : "Couldn't get a fare. Try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [pickupId, dropoffId, ride, toast]);

  // ---- payment methods + UniHop Cash, once the rider starts choosing ----
  useEffect(() => {
    if (step === "home" || methods) return;
    Promise.all([api.listPaymentMethods(), api.getCredits()])
      .then(([m, c]) => {
        setMethods(m);
        setMethodId((id) => id ?? m.find((x) => x.isDefault)?.id ?? m[0]?.id ?? null);
        setCredits(c.balance);
        setUseCredits(c.balance > 0);
      })
      .catch(() => setMethods([]));
  }, [step, methods]);

  // ---- live ride: status + location ----
  const rideId = ride?.id;
  useEffect(() => {
    if (!rideId) return;
    const offStatus = realtime.subscribeRideStatus(rideId, (e) => {
      if (e.status !== lastStatus.current) {
        if (e.status === "ACCEPTED") haptic("accepted");
        if (e.status === "ARRIVED") haptic("arrived");
        if (e.status === "COMPLETED") haptic("success");
        lastStatus.current = e.status;
      }
      setRide((r) => (r ? { ...r, status: e.status, driver: e.driver ?? r.driver } : r));
      if (e.etaSeconds != null) setEtaSeconds(e.etaSeconds);
      if (e.driver?.lat != null && e.driver.lng != null) setDriverPos((p) => p ?? { lat: e.driver!.lat!, lng: e.driver!.lng! });
      api.getRide(rideId).then(setRide).catch(() => {});
    });
    const offLoc = realtime.subscribeRideLocation(rideId, (e) => {
      setDriverPos({ lat: e.lat, lng: e.lng, heading: e.heading });
      setEtaSeconds(e.etaSeconds);
    });
    return () => {
      offStatus();
      offLoc();
    };
  }, [rideId]);

  // ---- actions ----
  const chooseDropoff = useCallback(
    (id: string) => {
      if (id === pickupId) {
        toast.show({ tone: "info", message: "That's your pickup. Pick a different stop." });
        return;
      }
      haptic("tick");
      setDropoffId(id);
      setQuote(null);
      setRequestError(null);
      setStep("options");
    },
    [pickupId, toast],
  );

  const choosePickup = useCallback(
    (id: string) => {
      if (id === dropoffId) return;
      setPickupId(id);
      setRequestError(null);
    },
    [dropoffId],
  );

  const request = useCallback(async () => {
    if (!pickupId || !dropoffId || requesting) return;
    setRequesting(true);
    setRequestError(null);
    try {
      const r = await api.createRide({ pickupHubId: pickupId, dropoffHubId: dropoffId, paymentMethodId: methodId ?? undefined, useCredits });
      adoptRide(r);
      setRequestedAt(Date.now());
      haptic("tick");
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.code === "ACTIVE_RIDE_EXISTS") {
          const active = await api.getActiveRide().catch(() => null);
          if (active) adoptRide(active);
        } else if (e.code === "PAYMENT_DECLINED") {
          haptic("error");
          setRequestError({ code: e.code, declineCode: e.declineCode, message: e.declineCode ? DECLINE_COPY[e.declineCode] : e.message });
        } else if (e.code === "PAYMENT_METHOD_REQUIRED") {
          haptic("error");
          setRequestError({ code: e.code, message: "Add a payment method to request this ride." });
        } else {
          setRequestError({ code: e.code, message: e.message });
        }
      } else {
        setRequestError({ code: "INTERNAL_ERROR", message: "Something went wrong. Try again." });
      }
    } finally {
      setRequesting(false);
    }
  }, [pickupId, dropoffId, methodId, useCredits, requesting, adoptRide]);

  const cancel = useCallback(async () => {
    if (!ride) return;
    try {
      setRide(await api.cancelRide(ride.id, "Changed plans"));
    } catch (e) {
      toast.show({ tone: "error", message: e instanceof ApiRequestError ? e.message : "Couldn't cancel. Try again." });
    }
  }, [ride, toast]);

  const reset = useCallback(() => {
    setRide(null);
    setStep("home");
    setDropoffId(null);
    setQuote(null);
    setDriverPos(null);
    setEtaSeconds(null);
    setRequestError(null);
    setRequestedAt(null);
    setRated(false);
    lastStatus.current = null;
    api.getCredits().then((c) => setCredits(c.balance)).catch(() => {});
  }, []);

  const retry = useCallback(() => {
    setRide(null);
    setDriverPos(null);
    setEtaSeconds(null);
    setStep("confirm");
  }, []);

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

  const phase: RiderPhase = ride ? phaseFor(ride.status) : step;
  const pickup = hubs?.find((h) => h.id === pickupId) ?? null;
  const dropoff = hubs?.find((h) => h.id === dropoffId) ?? null;
  const method = methods?.find((m) => m.id === methodId) ?? null;

  return useMemo(
    () => ({
      phase,
      hubs,
      hubsError,
      loadHubs,
      resuming,
      pickup,
      dropoff,
      quote,
      methods,
      method,
      setMethodId,
      credits,
      useCredits,
      setUseCredits,
      ride,
      driverPos,
      etaSeconds,
      requesting,
      requestError,
      requestedAt,
      rated,
      goHome: () => {
        setStep("home");
        setRequestError(null);
      },
      toOptions: () => setStep("options"),
      toConfirm: () => setStep("confirm"),
      chooseDropoff,
      choosePickup,
      request,
      cancel,
      reset,
      retry,
      rate,
    }),
    [phase, hubs, hubsError, loadHubs, resuming, pickup, dropoff, quote, methods, method, credits, useCredits, ride, driverPos, etaSeconds, requesting, requestError, requestedAt, rated, chooseDropoff, choosePickup, request, cancel, reset, retry, rate],
  );
}

export type RideFlow = ReturnType<typeof useRideFlow>;
