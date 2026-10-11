// In-memory mock backend implementing ApiClient (enabled by NEXT_PUBLIC_USE_MOCKS=true).
// Follows docs/contract.md rules: same DTOs, error codes, payment lifecycle, and WS events.
//
// Mock-only conveniences (the real backend differs):
//   - OTP is always 123456.
//   - Ride with promoCode "NODRIVERS" ends in NO_DRIVERS after ~6s.
//   - Promo code "SCARLET5" redeems $5 (stretch endpoint).
//   - Driver mode: while online you get an offer every ~5s. Every 3rd offer is revoked by the rider
//     after 6s (OFFER_REVOKED). The rider PIN for offered rides is always 1234.
//   - State persists in localStorage ("unihop.mockdb.v1"). Call resetMockDb() to start over.
import type { ApiClient } from "@/lib/api";
import { paymentMethodLabel } from "@/lib/cards";
import { ApiRequestError, getToken } from "@/lib/session";
import type {
  AdminStats,
  AssistantCommand,
  CancelledBy,
  ChatMessage,
  CreditTxnType,
  Credits,
  DeclineCode,
  DriverCard,
  DriverProfile,
  FareBreakdown,
  Hub,
  OfferStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentSummary,
  Receipt,
  Ride,
  RideOffer,
  RideStatus,
  RideSummary,
  User,
} from "@/lib/types";
import { TERMINAL_RIDE_STATUSES } from "@/lib/types";
import { publish } from "./bus";
import {
  CREDIT_TXNS,
  DRIVER_PROFILES,
  farePrice,
  HUBS,
  ID,
  type MockCreditTxn,
  type MockEarning,
  type MockPaymentMethod,
  type MockUser,
  PAYMENT_METHODS,
  USERS,
  VAULT,
  type VaultEntry,
} from "./data";
import { newChargeId, toCardToken, tokenize, walletToken } from "./mockpay";

// ---------- state ----------

interface MockRide {
  id: string;
  riderId: string;
  driverId: string | null;
  pickupHubId: string;
  dropoffHubId: string;
  status: RideStatus;
  fare: FareBreakdown;
  pin: string | null;
  shareToken: string;
  promoCode: string | null;
  cancelReason: string | null;
  cancelledBy: CancelledBy | null;
  scheduledFor: string | null;
  requestedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  /** true: driver is auto-driven by the mock simulator (rider-side demo). */
  simulated: boolean;
  /** 0..1 progress along the current leg, for resuming after reload. */
  legProgress: number;
}

interface MockRidePayment {
  rideId: string;
  userId: string;
  paymentMethodId: string | null;
  amountTotal: number;
  creditsApplied: number;
  cardAmount: number;
  status: PaymentStatus;
  gatewayRef: string | null;
  declineCode: DeclineCode | null;
  methodLabel: string;
}

interface MockOffer {
  id: string;
  rideId: string;
  driverId: string;
  status: OfferStatus;
  offeredAt: string;
  expiresAt: string;
  distanceToPickupMeters: number;
}

interface MockRating {
  rideId: string;
  raterId: string;
  rateeId: string;
  stars: number;
}

interface MockDb {
  users: MockUser[];
  driverProfiles: DriverProfile[];
  vault: VaultEntry[];
  paymentMethods: MockPaymentMethod[];
  creditTxns: MockCreditTxn[];
  earnings: MockEarning[];
  rides: MockRide[];
  payments: MockRidePayment[];
  offers: MockOffer[];
  ratings: MockRating[];
  chat: Array<ChatMessage & { rideId: string }>;
  otps: Record<string, string>;
  offerCounter: number;
}

const STORAGE_KEY = "unihop.mockdb.v1";
const MOCK_OTP = "123456";
const MOCK_RIDER_ID = "00000000-0000-0000-0000-000000000199";
const OFFER_SECONDS = 15;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function seedDb(): MockDb {
  return {
    users: clone(USERS),
    driverProfiles: clone(DRIVER_PROFILES),
    vault: clone(VAULT),
    paymentMethods: clone(PAYMENT_METHODS),
    creditTxns: clone(CREDIT_TXNS),
    earnings: [],
    rides: [],
    payments: [],
    offers: [],
    ratings: [],
    chat: [],
    otps: {},
    offerCounter: 0,
  };
}

let db: MockDb | null = null;

function getDb(): MockDb {
  if (db) return db;
  db = seedDb();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) db = JSON.parse(raw) as MockDb;
    } catch {
      // corrupted or blocked storage: start from seed
    }
    resumeTimers(db);
  }
  return db;
}

function save(): void {
  if (typeof window === "undefined" || !db) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked: state lives in memory only
  }
}

export function resetMockDb(): void {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  db = seedDb();
  save();
}

// ---------- helpers ----------

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const latency = () => sleep(250 + Math.random() * 250);
const MOCKPAY_LATENCY_MS = 800;

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // crypto.randomUUID is unavailable on plain-http LAN origins (phones), so fall back.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function fail(status: number, error: string, message: string, declineCode?: DeclineCode): never {
  throw new ApiRequestError(status, { error, message, declineCode });
}

function me(): MockUser {
  const token = getToken();
  const id = token?.startsWith("mock.") ? token.slice(5) : null;
  const user = id ? getDb().users.find((u) => u.id === id) : undefined;
  if (!user) fail(401, "UNAUTHORIZED", "Authentication required");
  return user;
}

function hub(id: string): Hub {
  const h = HUBS.find((x) => x.id === id);
  if (!h) fail(404, "HUB_NOT_FOUND", `Unknown hub ${id}`);
  return h;
}

function assistantHubs(message: string): Hub[] {
  const text = message.toLowerCase();
  const aliases = new Map<string, string[]>([
    [ID.yard, ["the yard", "yard"]],
    [ID.buschSc, ["busch student center", "busch"]],
    [ID.liviSc, ["livingston student center", "livingston", "livi"]],
    [ID.cookCc, ["cook campus center", "cook student center", "cook"]],
    [ID.douglassSc, ["douglass student center", "douglass"]],
    [ID.nbStation, ["new brunswick station", "train station", "station"]],
  ]);
  return [...aliases]
    .map(([id, names]) => {
      const positions = names.map((name) => text.indexOf(name)).filter((index) => index >= 0);
      return { hub: HUBS.find((candidate) => candidate.id === id)!, index: positions.length ? Math.min(...positions) : -1 };
    })
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((match) => match.hub);
}

function mockAssistantCommand(message: string): AssistantCommand {
  const user = me();
  const text = message.trim().toLowerCase();
  if (!text || text.length > 500) fail(400, "VALIDATION_ERROR", "Message must contain 1-500 characters");
  if (/\b(stop|cancel)\b.*\b(watch|watching|look|looking)\b/.test(text)) {
    return user.mode === "DRIVER"
      ? { action: "STOP_WATCHING", reply: "I stopped watching for destination-matched rides.", pickupHubId: null, dropoffHubId: null }
      : { action: "HELP", reply: "Switch to driver mode to manage a ride watch.", pickupHubId: null, dropoffHubId: null };
  }
  const matches = assistantHubs(text);
  if (user.mode === "RIDER") {
    if (matches.length !== 2 || matches[0].id === matches[1].id) {
      return { action: "HELP", reply: "Tell me two campus hubs, like “Book from The Yard to Busch Student Center.”", pickupHubId: null, dropoffHubId: null };
    }
    return {
      action: "BOOK_RIDE",
      reply: `Booking your ride from ${matches[0].name} to ${matches[1].name}.`,
      pickupHubId: matches[0].id,
      dropoffHubId: matches[1].id,
    };
  }
  if (matches.length !== 1) {
    return { action: "HELP", reply: "Tell me one destination, like “Find rides ending at Cook Campus Center.”", pickupHubId: null, dropoffHubId: null };
  }
  return {
    action: "WATCH_RIDES",
    reply: `Watching for rides ending at ${matches[0].name}.`,
    pickupHubId: null,
    dropoffHubId: matches[0].id,
  };
}

function fareFor(fromHubId: string, toHubId: string): FareBreakdown {
  if (fromHubId === toHubId) fail(400, "SAME_HUB", "Pickup and dropoff must be different hubs");
  const total = farePrice(hub(fromHubId).zone, hub(toHubId).zone);
  const baseFare = r2(total - 1.5);
  const driverPayout = r2(baseFare * 0.9);
  return { total, platformFee: 1.5, baseFare, driverPayout, platformMargin: r2(total - driverPayout) };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

function toUser(u: MockUser): User {
  const profile = getDb().driverProfiles.find((p) => p.userId === u.id);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    mode: u.mode,
    ratingAvg: u.ratingAvg,
    ratingCount: u.ratingCount,
    isDriverApproved: profile?.status === "APPROVED",
  };
}

function toPaymentMethod(p: MockPaymentMethod): PaymentMethod {
  return {
    id: p.id,
    type: p.type,
    brand: p.brand,
    last4: p.last4,
    expMonth: p.expMonth,
    expYear: p.expYear,
    nickname: p.nickname,
    isDefault: p.isDefault,
    label: paymentMethodLabel(p.type, p.brand, p.last4),
  };
}

function activeMethods(userId: string): MockPaymentMethod[] {
  return getDb()
    .paymentMethods.filter((p) => p.userId === userId && !p.deletedAt)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt));
}

function ownedMethod(userId: string, id: string): MockPaymentMethod {
  const p = activeMethods(userId).find((x) => x.id === id);
  if (!p) fail(404, "NOT_FOUND", "Payment method not found");
  return p;
}

function vaultBehavior(p: MockPaymentMethod) {
  return getDb().vault.find((v) => v.token === p.gatewayToken)?.behavior ?? "SUCCESS";
}

/** Gateway charge/authorize against a saved method. Throws 402 PAYMENT_DECLINED like the real gateway. */
function gatewayCharge(p: MockPaymentMethod): string {
  const behavior = vaultBehavior(p);
  if (behavior !== "SUCCESS") fail(402, "PAYMENT_DECLINED", declineMessage(behavior), behavior);
  return newChargeId();
}

function declineMessage(code: DeclineCode): string {
  switch (code) {
    case "CARD_DECLINED":
      return "Your card was declined.";
    case "INSUFFICIENT_FUNDS":
      return "Your card has insufficient funds.";
    case "EXPIRED_CARD":
      return "Your card has expired.";
    case "INCORRECT_CVC":
      return "Your card's security code is incorrect.";
  }
}

function creditBalance(userId: string): number {
  return r2(getDb().creditTxns.filter((t) => t.userId === userId).reduce((s, t) => s + t.amount, 0));
}

function addCredit(userId: string, type: CreditTxnType, amount: number, rideId: string | null) {
  getDb().creditTxns.push({ id: uuid(), userId, rideId, type, amount: r2(amount), createdAt: nowIso() });
}

function toCredits(userId: string): Credits {
  const transactions = getDb()
    .creditTxns.filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, type, amount, rideId, createdAt }) => ({ id, type, amount, rideId, createdAt }));
  return { balance: creditBalance(userId), transactions };
}

// ---------- payments lifecycle (mirrors PaymentService) ----------

function authorizeRide(rideId: string, riderId: string, paymentMethodId: string | undefined, useCredits: boolean, amount: number): MockRidePayment {
  const credits = useCredits ? Math.min(creditBalance(riderId), amount) : 0;
  const cardAmount = r2(amount - credits);
  let method: MockPaymentMethod | null = null;
  let gatewayRef: string | null = null;
  if (cardAmount > 0) {
    method = paymentMethodId ? ownedMethod(riderId, paymentMethodId) : (activeMethods(riderId).find((p) => p.isDefault) ?? null);
    if (!method) fail(402, "PAYMENT_METHOD_REQUIRED", "Add a payment method to request this ride");
    gatewayRef = gatewayCharge(method);
  }
  if (credits > 0) addCredit(riderId, "RIDE_SPEND", -credits, rideId);
  const cardLabel = method ? paymentMethodLabel(method.type, method.brand, method.last4) : null;
  const methodLabel = credits > 0 && cardLabel ? `UniHop Cash + ${cardLabel}` : credits > 0 ? "UniHop Cash" : cardLabel!;
  const payment: MockRidePayment = {
    rideId,
    userId: riderId,
    paymentMethodId: method?.id ?? null,
    amountTotal: amount,
    creditsApplied: r2(credits),
    cardAmount,
    status: "AUTHORIZED",
    gatewayRef,
    declineCode: null,
    methodLabel,
  };
  getDb().payments.push(payment);
  return payment;
}

function captureRide(ride: MockRide) {
  const p = getDb().payments.find((x) => x.rideId === ride.id);
  if (!p || p.status !== "AUTHORIZED") return; // idempotent
  p.status = "CAPTURED";
  if (ride.driverId) {
    getDb().earnings.push({
      id: uuid(),
      driverId: ride.driverId,
      rideId: ride.id,
      type: "RIDE_EARNING",
      amount: ride.fare.driverPayout,
      paymentMethodId: null,
      createdAt: nowIso(),
    });
  }
}

function voidRide(ride: MockRide) {
  const p = getDb().payments.find((x) => x.rideId === ride.id);
  if (!p || p.status !== "AUTHORIZED") return; // idempotent
  p.status = "VOIDED";
  if (p.creditsApplied > 0) addCredit(p.userId, "RIDE_REFUND", p.creditsApplied, ride.id);
}

function toPaymentSummary(rideId: string): PaymentSummary {
  const p = getDb().payments.find((x) => x.rideId === rideId);
  if (!p) return { status: "FAILED", methodLabel: "", creditsApplied: 0, cardAmount: 0, amountTotal: 0, declineCode: null };
  return {
    status: p.status,
    methodLabel: p.methodLabel,
    creditsApplied: p.creditsApplied,
    cardAmount: p.cardAmount,
    amountTotal: p.amountTotal,
    declineCode: p.declineCode,
  };
}

// ---------- rides ----------

const TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  REQUESTED: ["ACCEPTED", "CANCELLED", "NO_DRIVERS"],
  ACCEPTED: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_DRIVERS: [],
};

function transition(ride: MockRide, to: RideStatus) {
  if (!TRANSITIONS[ride.status].includes(to)) {
    fail(409, "INVALID_TRANSITION", `Cannot go from ${ride.status} to ${to}`);
  }
  ride.status = to;
  ride.legProgress = 0;
  const t = nowIso();
  if (to === "ACCEPTED") ride.acceptedAt = t;
  if (to === "ARRIVED") ride.arrivedAt = t;
  if (to === "IN_PROGRESS") ride.startedAt = t;
  if (to === "COMPLETED") ride.completedAt = t;
  if (to === "CANCELLED" || to === "NO_DRIVERS") ride.cancelledAt = t;
}

const isActive = (r: MockRide) => !TERMINAL_RIDE_STATUSES.includes(r.status);

function findRide(id: string): MockRide {
  const r = getDb().rides.find((x) => x.id === id);
  if (!r) fail(404, "NOT_FOUND", "Ride not found");
  return r;
}

function participantRide(id: string, userId: string): MockRide {
  const r = findRide(id);
  if (r.riderId !== userId && r.driverId !== userId) fail(403, "FORBIDDEN", "Not your ride");
  return r;
}

function driverRide(id: string, userId: string): MockRide {
  const r = findRide(id);
  if (r.driverId !== userId) fail(403, "FORBIDDEN", "Only the assigned driver can do this");
  return r;
}

function driverCard(driverId: string | null): DriverCard | null {
  if (!driverId) return null;
  const u = getDb().users.find((x) => x.id === driverId);
  const p = getDb().driverProfiles.find((x) => x.userId === driverId);
  if (!u || !p) return null;
  return { id: u.id, name: u.name, ratingAvg: u.ratingAvg, carMake: p.carMake, carModel: p.carModel, carColor: p.carColor, plate: p.plate, lat: p.lat, lng: p.lng };
}

function toRide(r: MockRide, viewerId: string): Ride {
  const rider = getDb().users.find((u) => u.id === r.riderId)!;
  return {
    id: r.id,
    status: r.status,
    payment: toPaymentSummary(r.id),
    rider: { id: rider.id, name: rider.name, ratingAvg: rider.ratingAvg },
    driver: driverCard(r.driverId),
    pickupHub: hub(r.pickupHubId),
    dropoffHub: hub(r.dropoffHubId),
    fare: r.fare,
    pin: viewerId === r.riderId ? r.pin : null,
    shareToken: r.shareToken,
    requestedAt: r.requestedAt,
    acceptedAt: r.acceptedAt,
    arrivedAt: r.arrivedAt,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    cancelReason: r.cancelReason,
    cancelledBy: r.cancelledBy,
  };
}

function toSummary(r: MockRide): RideSummary {
  return {
    id: r.id,
    status: r.status,
    pickupHubName: hub(r.pickupHubId).name,
    dropoffHubName: hub(r.dropoffHubId).name,
    total: r.fare.total,
    driverPayout: r.fare.driverPayout,
    completedAt: r.completedAt,
    requestedAt: r.requestedAt,
  };
}

function legEta(r: MockRide): number | null {
  if (r.status === "ACCEPTED") return Math.round((1 - r.legProgress) * PICKUP_STEPS * STEP_MS / 1000);
  if (r.status === "IN_PROGRESS") return Math.round((1 - r.legProgress) * DROPOFF_STEPS * STEP_MS / 1000);
  return null;
}

function publishStatus(r: MockRide) {
  publish(`/topic/rides/${r.id}/status`, {
    rideId: r.id,
    status: r.status,
    driver: driverCard(r.driverId),
    etaSeconds: legEta(r),
    updatedAt: nowIso(),
  });
}

function cancelLiveOffers(rideId: string) {
  getDb()
    .offers.filter((o) => o.rideId === rideId && o.status === "OFFERED")
    .forEach((o) => {
      o.status = "EXPIRED";
      publish(`/topic/drivers/${o.driverId}/offers`, { type: "OFFER_REVOKED", offerId: o.id });
    });
}

function endWithNoDrivers(r: MockRide) {
  if (r.status !== "REQUESTED") return;
  cancelLiveOffers(r.id);
  transition(r, "NO_DRIVERS");
  r.cancelledBy = "SYSTEM";
  r.cancelReason = "No drivers available";
  voidRide(r);
  save();
  publishStatus(r);
}

// ---------- simulator for rider-side rides (seeded drivers auto-drive) ----------

const STEP_MS = 1500;
const PICKUP_STEPS = 8;
const DROPOFF_STEPS = 10;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function schedule(key: string, ms: number, fn: () => void) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      try {
        fn();
      } catch (e) {
        console.error("[mock] timer error", e);
      }
    }, ms),
  );
}

function pickSimDriver(r: MockRide): string | null {
  const d = getDb();
  const busy = new Set(d.rides.filter((x) => isActive(x) && x.driverId).map((x) => x.driverId));
  const pickup = hub(r.pickupHubId);
  const seeded = new Set<string>([ID.driver1, ID.driver2, ID.driver3, ID.driver4, ID.driver5]);
  const candidates = d.driverProfiles
    .filter((p) => seeded.has(p.userId) && p.status === "APPROVED" && p.isOnline && !busy.has(p.userId) && p.userId !== r.riderId)
    .filter((p) => p.lat !== null && p.lng !== null)
    .sort((a, b) => haversineMeters(a.lat!, a.lng!, pickup.lat, pickup.lng) - haversineMeters(b.lat!, b.lng!, pickup.lat, pickup.lng));
  return candidates[0]?.userId ?? null;
}

function simulate(rideId: string) {
  const r = getDb().rides.find((x) => x.id === rideId);
  if (!r || !r.simulated || !isActive(r)) return;
  const key = `ride:${rideId}`;

  switch (r.status) {
    case "REQUESTED": {
      if (r.promoCode === "NODRIVERS") return schedule(key, 6000, () => endWithNoDrivers(r));
      return schedule(key, 3000, () => {
        if (r.status !== "REQUESTED") return;
        const driverId = pickSimDriver(r);
        if (!driverId) return endWithNoDrivers(r);
        r.driverId = driverId;
        r.pin = String(Math.floor(1000 + Math.random() * 9000));
        transition(r, "ACCEPTED");
        save();
        publishStatus(r);
        simulate(rideId);
      });
    }
    case "ACCEPTED":
      return driveLeg(r, hub(r.pickupHubId), PICKUP_STEPS, () => {
        transition(r, "ARRIVED");
        save();
        publishStatus(r);
        simulate(rideId);
      });
    case "ARRIVED":
      return schedule(key, 4000, () => {
        if (r.status !== "ARRIVED") return;
        transition(r, "IN_PROGRESS");
        save();
        publishStatus(r);
        simulate(rideId);
      });
    case "IN_PROGRESS":
      return driveLeg(r, hub(r.dropoffHubId), DROPOFF_STEPS, () => {
        transition(r, "COMPLETED");
        captureRide(r);
        save();
        publishStatus(r);
      });
  }
}

/** Moves the driver toward `target` in steps, publishing location events, then calls `done`. */
function driveLeg(r: MockRide, target: Hub, steps: number, done: () => void) {
  const status = r.status;
  const profile = getDb().driverProfiles.find((p) => p.userId === r.driverId);
  if (!profile || profile.lat === null || profile.lng === null) return done();
  const step = () => {
    if (r.status !== status) return; // cancelled meanwhile
    const remaining = Math.max(1, Math.round((1 - r.legProgress) * steps));
    const lat0 = profile.lat!;
    const lng0 = profile.lng!;
    const lat = lat0 + (target.lat - lat0) / remaining;
    const lng = lng0 + (target.lng - lng0) / remaining;
    const heading = bearing(lat0, lng0, lat, lng);
    profile.lat = lat;
    profile.lng = lng;
    r.legProgress = Math.min(1, r.legProgress + 1 / steps);
    save();
    publish(`/topic/rides/${r.id}/location`, { lat, lng, heading, etaSeconds: legEta(r) ?? 0 });
    if (r.legProgress >= 0.999) done();
    else schedule(`ride:${r.id}`, STEP_MS, step);
  };
  schedule(`ride:${r.id}`, STEP_MS, step);
}

// ---------- driver-mode offers (the logged-in user is a real driver; never auto-driven) ----------

function ensureMockRider() {
  const d = getDb();
  if (!d.users.some((u) => u.id === MOCK_RIDER_ID)) {
    d.users.push({ id: MOCK_RIDER_ID, email: "taylor@scarletmail.rutgers.edu", name: "Taylor Brooks", phone: null, mode: "RIDER", ratingAvg: 4.9, ratingCount: 18, createdAt: nowIso() });
  }
}

function scheduleNextOffer(driverId: string, delayMs = 5000) {
  schedule(`offers:${driverId}`, delayMs, () => makeOffer(driverId));
}

function makeOffer(driverId: string) {
  const d = getDb();
  const profile = d.driverProfiles.find((p) => p.userId === driverId);
  const token = getToken();
  if (!profile?.isOnline || token !== `mock.${driverId}`) return; // went offline or logged out
  const busy = d.rides.some((r) => isActive(r) && r.driverId === driverId) || d.offers.some((o) => o.driverId === driverId && o.status === "OFFERED");
  if (busy) return;

  ensureMockRider();
  const [pickup, dropoff] = [...HUBS].sort(() => Math.random() - 0.5);
  const ride: MockRide = {
    id: uuid(),
    riderId: MOCK_RIDER_ID,
    driverId: null,
    pickupHubId: pickup.id,
    dropoffHubId: dropoff.id,
    status: "REQUESTED",
    fare: fareFor(pickup.id, dropoff.id),
    pin: "1234",
    shareToken: uuid().replace(/-/g, ""),
    promoCode: null,
    cancelReason: null,
    cancelledBy: null,
    scheduledFor: null,
    requestedAt: nowIso(),
    acceptedAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    simulated: false,
    legProgress: 0,
  };
  d.rides.push(ride);
  d.payments.push({
    rideId: ride.id, userId: MOCK_RIDER_ID, paymentMethodId: null, amountTotal: ride.fare.total, creditsApplied: 0,
    cardAmount: ride.fare.total, status: "AUTHORIZED", gatewayRef: newChargeId(), declineCode: null, methodLabel: "Visa •••• 4242",
  });
  const offeredAt = new Date();
  const offer: MockOffer = {
    id: uuid(),
    rideId: ride.id,
    driverId,
    status: "OFFERED",
    offeredAt: offeredAt.toISOString(),
    expiresAt: new Date(offeredAt.getTime() + OFFER_SECONDS * 1000).toISOString(),
    distanceToPickupMeters: Math.round(haversineMeters(profile.lat ?? pickup.lat, profile.lng ?? pickup.lng, pickup.lat, pickup.lng)),
  };
  d.offers.push(offer);
  d.offerCounter += 1;
  save();
  publish(`/topic/drivers/${driverId}/offers`, toRideOffer(offer));

  if (d.offerCounter % 3 === 0) {
    // Demo OFFER_REVOKED: the rider cancels before the driver answers.
    schedule(`offer:${offer.id}`, 6000, () => {
      if (offer.status !== "OFFERED") return;
      ride.cancelledBy = "RIDER";
      ride.cancelReason = "Changed plans";
      transition(ride, "CANCELLED");
      voidRide(ride);
      cancelLiveOffers(ride.id);
      save();
      scheduleNextOffer(driverId);
    });
  } else {
    schedule(`offer:${offer.id}`, OFFER_SECONDS * 1000, () => {
      if (offer.status !== "OFFERED") return;
      offer.status = "EXPIRED";
      endWithNoDrivers(ride);
      scheduleNextOffer(driverId);
    });
  }
}

function toRideOffer(o: MockOffer): RideOffer {
  const ride = findRide(o.rideId);
  const rider = getDb().users.find((u) => u.id === ride.riderId)!;
  return {
    offerId: o.id,
    rideId: o.rideId,
    pickupHub: hub(ride.pickupHubId),
    dropoffHub: hub(ride.dropoffHubId),
    fare: ride.fare,
    riderName: rider.name,
    riderRating: rider.ratingAvg,
    distanceToPickupMeters: o.distanceToPickupMeters,
    expiresAt: o.expiresAt,
  };
}

function liveOffer(rideId: string, driverId: string): MockOffer {
  const o = getDb().offers.find((x) => x.rideId === rideId && x.driverId === driverId && x.status === "OFFERED");
  if (!o) {
    const any = getDb().offers.some((x) => x.rideId === rideId && x.driverId === driverId);
    if (any) fail(409, "OFFER_NOT_ACTIVE", "This offer is no longer available");
    fail(403, "FORBIDDEN", "You don't hold an offer for this ride");
  }
  if (new Date(o.expiresAt).getTime() < Date.now()) fail(409, "OFFER_NOT_ACTIVE", "This offer expired");
  return o;
}

function resumeTimers(d: MockDb) {
  d.rides.filter((r) => r.simulated && isActive(r)).forEach((r) => simulate(r.id));
  // Offers that were live before a reload just expire.
  d.offers.filter((o) => o.status === "OFFERED").forEach((o) => {
    o.status = "EXPIRED";
    const ride = d.rides.find((r) => r.id === o.rideId);
    if (ride && ride.status === "REQUESTED") {
      ride.status = "NO_DRIVERS";
      ride.cancelledBy = "SYSTEM";
      ride.cancelledAt = nowIso();
      const p = d.payments.find((x) => x.rideId === ride.id);
      if (p && p.status === "AUTHORIZED") p.status = "VOIDED";
    }
  });
  const token = typeof window !== "undefined" ? getToken() : null;
  const userId = token?.startsWith("mock.") ? token.slice(5) : null;
  const profile = d.driverProfiles.find((p) => p.userId === userId);
  if (userId && profile?.isOnline) scheduleNextOffer(userId);
}

// ---------- the mock client ----------

export const mockApi: ApiClient = {
  // Auth and users
  async requestOtp(email) {
    await latency();
    const normalized = (email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@scarletmail\.rutgers\.edu$/.test(normalized)) {
      fail(400, "INVALID_EMAIL_DOMAIN", "Use your @scarletmail.rutgers.edu email");
    }
    getDb().otps[normalized] = MOCK_OTP;
    save();
    return { devOtp: MOCK_OTP };
  },

  async verifyOtp({ email, otp, name }) {
    await latency();
    const normalized = (email ?? "").trim().toLowerCase();
    const d = getDb();
    if (!d.otps[normalized] || d.otps[normalized] !== otp) fail(400, "INVALID_OTP", "That code is incorrect or expired");
    delete d.otps[normalized];
    let user = d.users.find((u) => u.email === normalized);
    if (!user) {
      const fallbackName = normalized.split("@")[0].replace(/[._]/g, " ");
      user = { id: uuid(), email: normalized, name: name?.trim() || fallbackName, phone: null, mode: "RIDER", ratingAvg: 5, ratingCount: 0, createdAt: nowIso() };
      d.users.push(user);
    }
    save();
    return { token: `mock.${user.id}`, user: toUser(user) };
  },

  async getMe() {
    await latency();
    return toUser(me());
  },

  async updateMe(body) {
    await latency();
    const u = me();
    if (body.mode === "DRIVER") {
      const p = getDb().driverProfiles.find((x) => x.userId === u.id);
      if (p?.status !== "APPROVED") fail(409, "DRIVER_NOT_ONBOARDED", "Finish driver onboarding first");
    }
    if (body.name !== undefined) u.name = body.name;
    if (body.phone !== undefined) u.phone = body.phone;
    if (body.mode !== undefined) u.mode = body.mode;
    save();
    return toUser(u);
  },

  // Drivers
  async onboardDriver(body) {
    await latency();
    const u = me();
    for (const k of ["licenseNumber", "carMake", "carModel", "carColor", "plate"] as const) {
      if (!body[k]?.trim()) fail(400, "VALIDATION_ERROR", `${k} is required`);
    }
    const d = getDb();
    let p = d.driverProfiles.find((x) => x.userId === u.id);
    if (!p) {
      p = { userId: u.id, ...body, status: "APPROVED", isOnline: false, lat: null, lng: null };
      d.driverProfiles.push(p);
    } else {
      Object.assign(p, body, { status: "APPROVED" });
    }
    save();
    return clone(p);
  },

  async getMyDriverProfile() {
    await latency();
    const p = getDb().driverProfiles.find((x) => x.userId === me().id);
    if (!p) fail(404, "NOT_FOUND", "Not onboarded as a driver");
    return clone(p);
  },

  // Hubs and pricing
  async getHubs() {
    await latency();
    return clone(HUBS);
  },

  async quoteFare(from, to) {
    await latency();
    me();
    return fareFor(from, to);
  },

  // Mock processor
  async tokenizeCard(body) {
    await sleep(MOCKPAY_LATENCY_MS);
    const entry = tokenize(body);
    getDb().vault.push(entry);
    save();
    return toCardToken(entry);
  },

  async createWalletToken(walletType) {
    await sleep(MOCKPAY_LATENCY_MS);
    if (walletType !== "APPLE_PAY" && walletType !== "GOOGLE_PAY") fail(400, "VALIDATION_ERROR", "walletType must be APPLE_PAY or GOOGLE_PAY");
    const entry = walletToken(walletType);
    getDb().vault.push(entry);
    save();
    return toCardToken(entry);
  },

  // Payment methods and credits
  async listPaymentMethods() {
    await latency();
    return activeMethods(me().id).map(toPaymentMethod);
  },

  async addPaymentMethod({ token, nickname }) {
    await latency();
    const u = me();
    const v = getDb().vault.find((x) => x.token === token);
    if (!v) fail(400, "VALIDATION_ERROR", "Unknown payment token");
    const existing = activeMethods(u.id);
    if (existing.some((p) => p.brand === v.brand && p.last4 === v.last4 && p.expMonth === v.expMonth && p.expYear === v.expYear)) {
      fail(409, "DUPLICATE_PAYMENT_METHOD", "You already saved this card");
    }
    const p: MockPaymentMethod = {
      id: uuid(),
      userId: u.id,
      type: v.walletType ?? "CARD",
      brand: v.brand,
      last4: v.last4,
      expMonth: v.expMonth,
      expYear: v.expYear,
      nickname: nickname?.trim() || null,
      isDefault: existing.length === 0,
      gatewayToken: v.token,
      createdAt: nowIso(),
      deletedAt: null,
    };
    getDb().paymentMethods.push(p);
    save();
    return toPaymentMethod(p);
  },

  async updatePaymentMethod(id, body) {
    await latency();
    const u = me();
    const p = ownedMethod(u.id, id);
    if (body.isDefault === true) activeMethods(u.id).forEach((x) => (x.isDefault = x.id === p.id));
    if (body.nickname !== undefined) p.nickname = body.nickname.trim() || null;
    save();
    return toPaymentMethod(p);
  },

  async deletePaymentMethod(id) {
    await latency();
    const u = me();
    const p = ownedMethod(u.id, id);
    const inUse = getDb().payments.some((x) => x.paymentMethodId === p.id && x.status === "AUTHORIZED");
    if (inUse) fail(409, "PAYMENT_METHOD_IN_USE", "This method is holding a payment for an active ride");
    p.deletedAt = nowIso();
    if (p.isDefault) {
      p.isDefault = false;
      const newest = activeMethods(u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (newest) newest.isDefault = true;
    }
    save();
  },

  async getCredits() {
    await latency();
    return toCredits(me().id);
  },

  async topupCredits({ amount, paymentMethodId }) {
    await sleep(MOCKPAY_LATENCY_MS);
    const u = me();
    if (![10, 20, 50].includes(amount)) fail(400, "VALIDATION_ERROR", "amount must be 10, 20 or 50");
    gatewayCharge(ownedMethod(u.id, paymentMethodId));
    addCredit(u.id, "TOPUP", amount, null);
    save();
    return toCredits(u.id);
  },

  async redeemPromo(code) {
    await latency();
    const u = me();
    if ((code ?? "").trim().toUpperCase() !== "SCARLET5") fail(400, "INVALID_PROMO_CODE", "That promo code isn't valid");
    addCredit(u.id, "PROMO", 5, null);
    save();
    return toCredits(u.id);
  },

  // Driver earnings
  async getEarnings() {
    await latency();
    const u = me();
    const entries = getDb().earnings.filter((e) => e.driverId === u.id);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
    const sumSince = (since: Date | null) =>
      r2(entries.filter((e) => e.type === "RIDE_EARNING" && (!since || new Date(e.createdAt) >= since)).reduce((s, e) => s + e.amount, 0));
    const rides = getDb()
      .rides.filter((r) => r.driverId === u.id && r.status === "COMPLETED")
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(toSummary);
    return {
      balance: r2(entries.reduce((s, e) => s + e.amount, 0)),
      today: sumSince(startOfDay),
      week: sumSince(startOfWeek),
      total: sumSince(null),
      rides,
    };
  },

  async cashout({ paymentMethodId }) {
    await sleep(MOCKPAY_LATENCY_MS);
    const u = me();
    const method = ownedMethod(u.id, paymentMethodId);
    const balance = r2(getDb().earnings.filter((e) => e.driverId === u.id).reduce((s, e) => s + e.amount, 0));
    if (balance <= 0) fail(409, "NOTHING_TO_CASH_OUT", "Your balance is $0.00");
    gatewayCharge(method);
    getDb().earnings.push({ id: uuid(), driverId: u.id, rideId: null, type: "PAYOUT", amount: -balance, paymentMethodId: method.id, createdAt: nowIso() });
    save();
    return { balance: 0, payoutAmount: balance, methodLabel: paymentMethodLabel(method.type, method.brand, method.last4) };
  },

  // Driver availability
  async goOnline({ lat, lng }) {
    await latency();
    const u = me();
    const p = getDb().driverProfiles.find((x) => x.userId === u.id);
    if (p?.status !== "APPROVED") fail(409, "DRIVER_NOT_ONBOARDED", "Finish driver onboarding first");
    Object.assign(p, { isOnline: true, lat, lng });
    save();
    scheduleNextOffer(u.id, 4000);
    return clone(p);
  },

  async goOffline() {
    await latency();
    const u = me();
    const p = getDb().driverProfiles.find((x) => x.userId === u.id);
    if (!p) fail(404, "NOT_FOUND", "Not onboarded as a driver");
    p.isOnline = false;
    const timer = timers.get(`offers:${u.id}`);
    if (timer) clearTimeout(timer);
    getDb()
      .offers.filter((o) => o.driverId === u.id && o.status === "OFFERED")
      .forEach((o) => {
        o.status = "EXPIRED";
        endWithNoDrivers(findRide(o.rideId));
      });
    save();
    return clone(p);
  },

  async updateLocation({ lat, lng }) {
    const u = me();
    const p = getDb().driverProfiles.find((x) => x.userId === u.id);
    if (!p) fail(404, "NOT_FOUND", "Not onboarded as a driver");
    const prevLat = p.lat ?? lat;
    const prevLng = p.lng ?? lng;
    Object.assign(p, { lat, lng });
    save();
    const ride = getDb().rides.find((r) => r.driverId === u.id && (r.status === "ACCEPTED" || r.status === "IN_PROGRESS"));
    if (ride) {
      const target = hub(ride.status === "ACCEPTED" ? ride.pickupHubId : ride.dropoffHubId);
      const etaSeconds = Math.round(haversineMeters(lat, lng, target.lat, target.lng) / 8); // ~8 m/s
      publish(`/topic/rides/${ride.id}/location`, { lat, lng, heading: bearing(prevLat, prevLng, lat, lng), etaSeconds });
    }
  },

  async getCurrentOffer() {
    await latency();
    const u = me();
    const o = getDb().offers.find((x) => x.driverId === u.id && x.status === "OFFERED" && new Date(x.expiresAt).getTime() > Date.now());
    return o ? toRideOffer(o) : null;
  },

  // Rides
  async createRide(body) {
    await sleep(MOCKPAY_LATENCY_MS);
    const u = me();
    const fare = fareFor(body.pickupHubId, body.dropoffHubId);
    if (getDb().rides.some((r) => r.riderId === u.id && isActive(r))) fail(409, "ACTIVE_RIDE_EXISTS", "You already have a ride in progress");
    const id = uuid();
    // Authorize first: a decline throws and no ride is created (same as the backend transaction).
    authorizeRide(id, u.id, body.paymentMethodId, body.useCredits ?? false, fare.total);
    const ride: MockRide = {
      id,
      riderId: u.id,
      driverId: null,
      pickupHubId: body.pickupHubId,
      dropoffHubId: body.dropoffHubId,
      status: "REQUESTED",
      fare,
      pin: null,
      shareToken: uuid().replace(/-/g, ""),
      promoCode: body.promoCode ?? null,
      cancelReason: null,
      cancelledBy: null,
      scheduledFor: body.scheduledFor ?? null,
      requestedAt: nowIso(),
      acceptedAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      simulated: true,
      legProgress: 0,
    };
    getDb().rides.push(ride);
    save();
    publishStatus(ride);
    simulate(id);
    return toRide(ride, u.id);
  },

  async getRide(id) {
    await latency();
    const u = me();
    return toRide(participantRide(id, u.id), u.id);
  },

  async getActiveRide() {
    await latency();
    const u = me();
    const r = getDb()
      .rides.filter((x) => isActive(x) && (x.riderId === u.id || x.driverId === u.id))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
    return r ? toRide(r, u.id) : null;
  },

  async acceptRide(id) {
    await latency();
    const u = me();
    const offer = liveOffer(id, u.id);
    const ride = findRide(id);
    offer.status = "ACCEPTED";
    ride.driverId = u.id;
    transition(ride, "ACCEPTED");
    const t = timers.get(`offer:${offer.id}`);
    if (t) clearTimeout(t);
    save();
    publishStatus(ride);
    return toRide(ride, u.id);
  },

  async declineRide(id) {
    await latency();
    const u = me();
    const offer = liveOffer(id, u.id);
    offer.status = "DECLINED";
    const t = timers.get(`offer:${offer.id}`);
    if (t) clearTimeout(t);
    endWithNoDrivers(findRide(id));
    save();
    scheduleNextOffer(u.id);
  },

  async markArrived(id) {
    await latency();
    const u = me();
    const ride = driverRide(id, u.id);
    transition(ride, "ARRIVED");
    save();
    publishStatus(ride);
    return toRide(ride, u.id);
  },

  async startRide(id, pin) {
    await latency();
    const u = me();
    const ride = driverRide(id, u.id);
    if (ride.status === "ARRIVED" && pin !== ride.pin) fail(400, "INVALID_PIN", "That PIN doesn't match");
    transition(ride, "IN_PROGRESS");
    save();
    publishStatus(ride);
    return toRide(ride, u.id);
  },

  async completeRide(id) {
    await latency();
    const u = me();
    const ride = driverRide(id, u.id);
    transition(ride, "COMPLETED");
    captureRide(ride);
    save();
    publishStatus(ride);
    if (getDb().driverProfiles.find((p) => p.userId === u.id)?.isOnline) scheduleNextOffer(u.id);
    return toRide(ride, u.id);
  },

  async cancelRide(id, reason) {
    await latency();
    const u = me();
    const ride = participantRide(id, u.id);
    transition(ride, "CANCELLED");
    ride.cancelledBy = ride.riderId === u.id ? "RIDER" : "DRIVER";
    ride.cancelReason = reason || null;
    const t = timers.get(`ride:${id}`);
    if (t) clearTimeout(t);
    cancelLiveOffers(id);
    voidRide(ride);
    save();
    publishStatus(ride);
    return toRide(ride, u.id);
  },

  async getSharedRide(shareToken) {
    await latency();
    const r = getDb().rides.find((x) => x.shareToken === shareToken);
    if (!r) fail(404, "NOT_FOUND", "Ride not found");
    const rider = getDb().users.find((u) => u.id === r.riderId)!;
    return {
      status: r.status,
      pickupHub: hub(r.pickupHubId),
      dropoffHub: hub(r.dropoffHubId),
      driver: driverCard(r.driverId),
      riderFirstName: rider.name.split(" ")[0],
      etaSeconds: legEta(r),
      updatedAt: nowIso(),
    };
  },

  async getChat(rideId) {
    await latency();
    participantRide(rideId, me().id);
    return getDb()
      .chat.filter((c) => c.rideId === rideId)
      .map(({ id, senderId, body, createdAt }) => ({ id, senderId, body, createdAt }));
  },

  async sendChat(rideId, body) {
    await latency();
    const u = me();
    const ride = participantRide(rideId, u.id);
    if (!body?.trim()) fail(400, "VALIDATION_ERROR", "Message can't be empty");
    const msg = { id: uuid(), rideId, senderId: u.id, body: body.trim(), createdAt: nowIso() };
    getDb().chat.push(msg);
    save();
    const { rideId: _omit, ...out } = msg;
    void _omit;
    publish(`/topic/rides/${rideId}/chat`, out);
    if (ride.simulated && ride.driverId && u.id === ride.riderId) {
      schedule(`chat:${rideId}`, 2000, () => {
        const reply = { id: uuid(), rideId, senderId: ride.driverId!, body: "Got it, see you soon!", createdAt: nowIso() };
        getDb().chat.push(reply);
        save();
        const { rideId: _r, ...replyOut } = reply;
        void _r;
        publish(`/topic/rides/${rideId}/chat`, replyOut);
      });
    }
    return out;
  },

  // Records
  async rateRide(id, { stars, comment }) {
    await latency();
    const u = me();
    const ride = participantRide(id, u.id);
    if (ride.status !== "COMPLETED") fail(409, "INVALID_TRANSITION", "You can only rate completed rides");
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, "VALIDATION_ERROR", "stars must be 1 to 5");
    if (getDb().ratings.some((r) => r.rideId === id && r.raterId === u.id)) fail(409, "ALREADY_RATED", "You already rated this ride");
    const rateeId = u.id === ride.riderId ? ride.driverId! : ride.riderId;
    getDb().ratings.push({ rideId: id, raterId: u.id, rateeId, stars });
    const ratee = getDb().users.find((x) => x.id === rateeId);
    if (ratee) {
      ratee.ratingAvg = r2((ratee.ratingAvg * ratee.ratingCount + stars) / (ratee.ratingCount + 1));
      ratee.ratingCount += 1;
    }
    void comment;
    save();
  },

  async getMyRides(mode) {
    await latency();
    const u = me();
    return getDb()
      .rides.filter((r) => (mode === "DRIVER" ? r.driverId === u.id : r.riderId === u.id))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(toSummary);
  },

  async getReceipt(id): Promise<Receipt> {
    await latency();
    const u = me();
    const r = participantRide(id, u.id);
    if (r.status !== "COMPLETED") fail(404, "NOT_FOUND", "Receipts are available after the ride completes");
    const name = (uid: string | null) => getDb().users.find((x) => x.id === uid)?.name ?? "";
    const duration = r.startedAt && r.completedAt ? Math.round((Date.parse(r.completedAt) - Date.parse(r.startedAt)) / 1000) : null;
    return {
      rideId: r.id,
      pickupHubName: hub(r.pickupHubId).name,
      dropoffHubName: hub(r.dropoffHubId).name,
      fare: r.fare,
      payment: toPaymentSummary(r.id),
      driverName: name(r.driverId),
      riderName: name(r.riderId),
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationSeconds: duration,
    };
  },

  async getAdminStats(): Promise<AdminStats> {
    await latency();
    const d = getDb();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = d.rides.filter((r) => new Date(r.requestedAt) >= startOfDay);
    const done = today.filter((r) => r.status === "COMPLETED");
    return {
      ridesToday: today.length,
      activeRides: d.rides.filter(isActive).length,
      driversOnline: d.driverProfiles.filter((p) => p.isOnline).length,
      grossToday: r2(done.reduce((s, r) => s + r.fare.total, 0)),
      marginToday: r2(done.reduce((s, r) => s + r.fare.platformMargin, 0)),
    };
  },

  async assistantCommand(message) {
    await latency();
    return mockAssistantCommand(message);
  },
};
