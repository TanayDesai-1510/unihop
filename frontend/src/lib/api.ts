// Typed client for every endpoint in docs/contract.md section 8.
// All UI code calls the backend through `api` only. With NEXT_PUBLIC_USE_MOCKS=true every call is
// served by src/mocks instead, with the same types, errors, and latency.
import { mockApi } from "@/mocks/api";
import type {
  AddPaymentMethodBody,
  AdminStats,
  AssistantCommand,
  ApiError,
  AuthResponse,
  CardToken,
  CashoutBody,
  CashoutResult,
  ChatMessage,
  CreateRideBody,
  Credits,
  DriverProfile,
  Earnings,
  FareBreakdown,
  HealthResponse,
  Hub,
  LatLng,
  OnboardDriverBody,
  OtpResponse,
  PaymentMethod,
  PublicRideView,
  RatingBody,
  Receipt,
  Ride,
  RideOffer,
  RideSummary,
  TokenizeCardBody,
  TopupBody,
  UpdateMeBody,
  UpdatePaymentMethodBody,
  User,
  UserMode,
  VerifyOtpBody,
  WalletType,
} from "./types";

import { ApiRequestError, getToken } from "./session";

export { ApiRequestError, getToken, setToken } from "./session";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
export const MOCKPAY_URL = process.env.NEXT_PUBLIC_MOCKPAY_URL ?? `${API_URL}/mockpay/v1`;
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------- The client interface (real and mock both implement it) ----------

export interface ApiClient {
  // Auth and users [Hriday]
  requestOtp(email: string): Promise<OtpResponse>;
  verifyOtp(body: VerifyOtpBody): Promise<AuthResponse>;
  getMe(): Promise<User>;
  updateMe(body: UpdateMeBody): Promise<User>;
  // Drivers [Hriday]
  onboardDriver(body: OnboardDriverBody): Promise<DriverProfile>;
  getMyDriverProfile(): Promise<DriverProfile>;
  // Hubs and pricing [Hriday]
  getHubs(): Promise<Hub[]>;
  quoteFare(fromHubId: string, toHubId: string): Promise<FareBreakdown>;
  // Mock processor [Hriday] — the only calls that carry raw card data
  tokenizeCard(body: TokenizeCardBody): Promise<CardToken>;
  createWalletToken(walletType: WalletType): Promise<CardToken>;
  // Payment methods and credits [Hriday]
  listPaymentMethods(): Promise<PaymentMethod[]>;
  addPaymentMethod(body: AddPaymentMethodBody): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, body: UpdatePaymentMethodBody): Promise<PaymentMethod>;
  deletePaymentMethod(id: string): Promise<void>;
  getCredits(): Promise<Credits>;
  topupCredits(body: TopupBody): Promise<Credits>;
  redeemPromo(code: string): Promise<Credits>;
  // Driver earnings [Hriday]
  getEarnings(): Promise<Earnings>;
  cashout(body: CashoutBody): Promise<CashoutResult>;
  // Driver availability [Dev]
  goOnline(location: LatLng): Promise<DriverProfile>;
  goOffline(): Promise<DriverProfile>;
  updateLocation(location: LatLng): Promise<void>;
  /** Live offer for the calling driver, or null (204). */
  getCurrentOffer(): Promise<RideOffer | null>;
  // Rides [Dev]
  createRide(body: CreateRideBody): Promise<Ride>;
  getRide(id: string): Promise<Ride>;
  /** Caller's active ride as rider or driver, or null (204). */
  getActiveRide(): Promise<Ride | null>;
  acceptRide(id: string): Promise<Ride>;
  declineRide(id: string): Promise<void>;
  markArrived(id: string): Promise<Ride>;
  startRide(id: string, pin: string): Promise<Ride>;
  completeRide(id: string): Promise<Ride>;
  cancelRide(id: string, reason: string): Promise<Ride>;
  getSharedRide(shareToken: string): Promise<PublicRideView>;
  getChat(rideId: string): Promise<ChatMessage[]>;
  sendChat(rideId: string, body: string): Promise<ChatMessage>;
  // Records [Hriday]
  rateRide(id: string, body: RatingBody): Promise<void>;
  getMyRides(mode: UserMode): Promise<RideSummary[]>;
  getReceipt(id: string): Promise<Receipt>;
  getAdminStats(): Promise<AdminStats>;
  // Claude assistant [Hriday backend, Tanay frontend]
  assistantCommand(message: string): Promise<AssistantCommand>;
}

// ---------- Real HTTP implementation ----------

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(method: Method, url: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiRequestError(0, { error: "NETWORK_ERROR", message: "Can't reach UniHop. Check your connection." });
  }

  if (res.status === 204) return null as T;
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(res.status, {
      error: err.error ?? "INTERNAL_ERROR",
      message: err.message ?? res.statusText,
      declineCode: err.declineCode,
    });
  }
  return data as T;
}

const a = (path: string) => `${API_URL}${path}`;
const m = (path: string) => `${MOCKPAY_URL}${path}`;
const enc = encodeURIComponent;

export const realApi: ApiClient = {
  requestOtp: (email) => request("POST", a("/api/auth/request-otp"), { email }, false),
  verifyOtp: (body) => request("POST", a("/api/auth/verify-otp"), body, false),
  getMe: () => request("GET", a("/api/users/me")),
  updateMe: (body) => request("PATCH", a("/api/users/me"), body),

  onboardDriver: (body) => request("POST", a("/api/drivers/onboard"), body),
  getMyDriverProfile: () => request("GET", a("/api/drivers/me")),

  getHubs: () => request("GET", a("/api/hubs"), undefined, false),
  quoteFare: (from, to) => request("GET", a(`/api/fares/quote?from=${enc(from)}&to=${enc(to)}`)),

  tokenizeCard: (body) => request("POST", m("/tokens"), body, false),
  createWalletToken: (walletType) => request("POST", m("/wallet-tokens"), { walletType }, false),

  listPaymentMethods: () => request("GET", a("/api/payment-methods")),
  addPaymentMethod: (body) => request("POST", a("/api/payment-methods"), body),
  updatePaymentMethod: (id, body) => request("PATCH", a(`/api/payment-methods/${enc(id)}`), body),
  deletePaymentMethod: (id) => request("DELETE", a(`/api/payment-methods/${enc(id)}`)),
  getCredits: () => request("GET", a("/api/credits")),
  topupCredits: (body) => request("POST", a("/api/credits/topup"), body),
  redeemPromo: (code) => request("POST", a("/api/credits/redeem"), { code }),

  getEarnings: () => request("GET", a("/api/me/earnings")),
  cashout: (body) => request("POST", a("/api/me/earnings/cashout"), body),

  goOnline: (location) => request("POST", a("/api/drivers/me/online"), location),
  goOffline: () => request("POST", a("/api/drivers/me/offline")),
  updateLocation: (location) => request("POST", a("/api/drivers/me/location"), location),
  getCurrentOffer: () => request("GET", a("/api/drivers/me/offer")),

  createRide: (body) => request("POST", a("/api/rides"), body),
  getRide: (id) => request("GET", a(`/api/rides/${enc(id)}`)),
  getActiveRide: () => request("GET", a("/api/rides/active")),
  acceptRide: (id) => request("POST", a(`/api/rides/${enc(id)}/accept`)),
  declineRide: (id) => request("POST", a(`/api/rides/${enc(id)}/decline`)),
  markArrived: (id) => request("POST", a(`/api/rides/${enc(id)}/arrived`)),
  startRide: (id, pin) => request("POST", a(`/api/rides/${enc(id)}/start`), { pin }),
  completeRide: (id) => request("POST", a(`/api/rides/${enc(id)}/complete`)),
  cancelRide: (id, reason) => request("POST", a(`/api/rides/${enc(id)}/cancel`), { reason }),
  getSharedRide: (shareToken) => request("GET", a(`/api/share/${enc(shareToken)}`), undefined, false),
  getChat: (rideId) => request("GET", a(`/api/rides/${enc(rideId)}/chat`)),
  sendChat: (rideId, body) => request("POST", a(`/api/rides/${enc(rideId)}/chat`), { body }),

  rateRide: (id, body) => request("POST", a(`/api/rides/${enc(id)}/rating`), body),
  getMyRides: (mode) => request("GET", a(`/api/me/rides?mode=${mode}`)),
  getReceipt: (id) => request("GET", a(`/api/rides/${enc(id)}/receipt`)),
  getAdminStats: () => request("GET", a("/api/admin/stats")),
  assistantCommand: (message) => request("POST", a("/api/assistant/commands"), { message }),
};

export const api: ApiClient = USE_MOCKS ? mockApi : realApi;

/** Always hits the real backend, even in mock mode (the home page shows backend status). */
export function checkHealth(): Promise<HealthResponse> {
  return request("GET", a("/api/health"), undefined, false);
}
