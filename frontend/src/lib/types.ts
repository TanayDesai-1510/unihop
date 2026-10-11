// Mirrors docs/contract.md exactly. Shared file: change only after the contract changes.
// Money is a number with 2 decimals. Timestamps are ISO-8601 UTC strings. IDs are UUID strings.

// ---------- Enums (contract section 3) ----------

export const RIDE_STATUSES = ["REQUESTED", "ACCEPTED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_DRIVERS"] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

export const OFFER_STATUSES = ["OFFERED", "ACCEPTED", "DECLINED", "EXPIRED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const USER_MODES = ["RIDER", "DRIVER"] as const;
export type UserMode = (typeof USER_MODES)[number];

export const DRIVER_STATUSES = ["PENDING", "APPROVED"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const ZONES = ["COLLEGE_AVE", "BUSCH", "LIVINGSTON", "COOK_DOUGLASS", "DOWNTOWN"] as const;
export type Zone = (typeof ZONES)[number];

export const PAYMENT_METHOD_TYPES = ["CARD", "APPLE_PAY", "GOOGLE_PAY"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const CARD_BRANDS = ["VISA", "MASTERCARD", "AMEX", "DISCOVER"] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

export const PAYMENT_STATUSES = ["AUTHORIZED", "CAPTURED", "VOIDED", "FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DECLINE_CODES = ["CARD_DECLINED", "INSUFFICIENT_FUNDS", "EXPIRED_CARD", "INCORRECT_CVC"] as const;
export type DeclineCode = (typeof DECLINE_CODES)[number];

export const CREDIT_TXN_TYPES = ["PROMO", "TOPUP", "RIDE_SPEND", "RIDE_REFUND"] as const;
export type CreditTxnType = (typeof CREDIT_TXN_TYPES)[number];

export const EARNING_TXN_TYPES = ["RIDE_EARNING", "PAYOUT"] as const;
export type EarningTxnType = (typeof EARNING_TXN_TYPES)[number];

export type WalletType = "APPLE_PAY" | "GOOGLE_PAY";
export type CancelledBy = "RIDER" | "DRIVER" | "SYSTEM";

export const TERMINAL_RIDE_STATUSES: readonly RideStatus[] = ["COMPLETED", "CANCELLED", "NO_DRIVERS"];

// ---------- Error codes (contract section 2) ----------

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_EMAIL_DOMAIN"
  | "INVALID_OTP"
  | "SAME_HUB"
  | "INVALID_PIN"
  | "INVALID_NUMBER"
  | "INVALID_EXPIRY"
  | "INVALID_CVC"
  | "INVALID_PROMO_CODE"
  | "UNAUTHORIZED"
  | "PAYMENT_DECLINED"
  | "PAYMENT_METHOD_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "HUB_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "DRIVER_NOT_ONBOARDED"
  | "ACTIVE_RIDE_EXISTS"
  | "OFFER_NOT_ACTIVE"
  | "DUPLICATE_PAYMENT_METHOD"
  | "PAYMENT_METHOD_IN_USE"
  | "ALREADY_RATED"
  | "NOTHING_TO_CASH_OUT"
  | "INTERNAL_ERROR";

export interface ApiError {
  error: ErrorCode | string;
  message: string;
  /** Only on 402 PAYMENT_DECLINED. */
  declineCode?: DeclineCode;
}

// ---------- DTOs (contract section 9) ----------

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  mode: UserMode;
  ratingAvg: number;
  ratingCount: number;
  isDriverApproved: boolean;
}

export interface DriverProfile {
  userId: string;
  licenseNumber: string;
  carMake: string;
  carModel: string;
  carColor: string;
  plate: string;
  status: DriverStatus;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
}

export interface Hub {
  id: string;
  code: string;
  name: string;
  zone: Zone;
  lat: number;
  lng: number;
}

export interface FareBreakdown {
  total: number;
  platformFee: number;
  baseFare: number;
  driverPayout: number;
  platformMargin: number;
}

export interface DriverCard {
  id: string;
  name: string;
  ratingAvg: number;
  carMake: string;
  carModel: string;
  carColor: string;
  plate: string;
  lat: number | null;
  lng: number | null;
}

export interface RideParticipant {
  id: string;
  name: string;
  ratingAvg: number;
}

export interface PaymentSummary {
  status: PaymentStatus;
  methodLabel: string;
  creditsApplied: number;
  cardAmount: number;
  amountTotal: number;
  declineCode: DeclineCode | null;
}

export interface Ride {
  id: string;
  status: RideStatus;
  payment: PaymentSummary;
  rider: RideParticipant;
  driver: DriverCard | null;
  pickupHub: Hub;
  dropoffHub: Hub;
  fare: FareBreakdown;
  /** Only returned to the rider; null for the driver. */
  pin: string | null;
  shareToken: string;
  requestedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: CancelledBy | null;
}

export interface RideSummary {
  id: string;
  status: RideStatus;
  pickupHubName: string;
  dropoffHubName: string;
  total: number;
  driverPayout: number;
  completedAt: string | null;
  requestedAt: string;
}

export interface Receipt {
  rideId: string;
  pickupHubName: string;
  dropoffHubName: string;
  fare: FareBreakdown;
  payment: PaymentSummary;
  driverName: string;
  riderName: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface RideOffer {
  offerId: string;
  rideId: string;
  pickupHub: Hub;
  dropoffHub: Hub;
  fare: FareBreakdown;
  riderName: string;
  riderRating: number;
  distanceToPickupMeters: number;
  expiresAt: string;
}

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  nickname: string | null;
  isDefault: boolean;
  /** e.g. "Visa •••• 4242", "Apple Pay" */
  label: string;
}

export interface CreditTransaction {
  id: string;
  type: CreditTxnType;
  amount: number;
  rideId: string | null;
  createdAt: string;
}

export interface Credits {
  balance: number;
  /** Newest first. */
  transactions: CreditTransaction[];
}

export interface Earnings {
  balance: number;
  today: number;
  week: number;
  total: number;
  rides: RideSummary[];
}

export interface CashoutResult {
  balance: number;
  payoutAmount: number;
  methodLabel: string;
}

export interface CardToken {
  token: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  walletType: WalletType | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface OtpResponse {
  devOtp: string;
}

export interface PublicRideView {
  status: RideStatus;
  pickupHub: Hub;
  dropoffHub: Hub;
  driver: DriverCard | null;
  riderFirstName: string;
  etaSeconds: number | null;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface AdminStats {
  ridesToday: number;
  activeRides: number;
  driversOnline: number;
  grossToday: number;
  marginToday: number;
}

export interface HealthResponse {
  status: "ok";
}

// ---------- Request bodies (contract section 8) ----------

export interface RequestOtpBody {
  email: string;
}

export interface VerifyOtpBody {
  email: string;
  otp: string;
  name?: string;
}

export interface UpdateMeBody {
  name?: string;
  phone?: string;
  mode?: UserMode;
}

export interface OnboardDriverBody {
  licenseNumber: string;
  carMake: string;
  carModel: string;
  carColor: string;
  plate: string;
}

export interface TokenizeCardBody {
  /** Raw card number. Only ever sent to /mockpay/v1/tokens. */
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

export interface WalletTokenBody {
  walletType: WalletType;
}

export interface AddPaymentMethodBody {
  token: string;
  nickname?: string;
}

export interface UpdatePaymentMethodBody {
  isDefault?: boolean;
  nickname?: string;
}

export type TopupAmount = 10 | 20 | 50;

export interface TopupBody {
  amount: TopupAmount;
  paymentMethodId: string;
}

export interface CashoutBody {
  paymentMethodId: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CreateRideBody {
  pickupHubId: string;
  dropoffHubId: string;
  paymentMethodId?: string;
  useCredits?: boolean;
  promoCode?: string;
  scheduledFor?: string;
}

export interface StartRideBody {
  pin: string;
}

export interface CancelRideBody {
  reason: string;
}

export interface RatingBody {
  stars: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

// ---------- WebSocket payloads (contract section 11) ----------

export interface OfferRevokedEvent {
  type: "OFFER_REVOKED";
  offerId: string;
}

export type DriverOfferEvent = RideOffer | OfferRevokedEvent;

export function isOfferRevoked(e: DriverOfferEvent): e is OfferRevokedEvent {
  return (e as OfferRevokedEvent).type === "OFFER_REVOKED";
}

export interface RideStatusEvent {
  rideId: string;
  status: RideStatus;
  driver: DriverCard | null;
  etaSeconds: number | null;
  updatedAt: string;
}

export interface RideLocationEvent {
  lat: number;
  lng: number;
  /** Degrees 0-360 clockwise from north. */
  heading: number;
  etaSeconds: number;
}
