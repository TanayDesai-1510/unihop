// Seed data mirroring backend V2__seed_data.sql and docs/contract.md section 7 (same UUIDs).
import type {
  CardBrand,
  CreditTxnType,
  DeclineCode,
  DriverProfile,
  EarningTxnType,
  Hub,
  PaymentMethodType,
  User,
  WalletType,
  Zone,
} from "@/lib/types";

export const ID = {
  rider1: "00000000-0000-0000-0000-000000000101",
  rider2: "00000000-0000-0000-0000-000000000102",
  driver1: "00000000-0000-0000-0000-000000000201",
  driver2: "00000000-0000-0000-0000-000000000202",
  driver3: "00000000-0000-0000-0000-000000000203",
  driver4: "00000000-0000-0000-0000-000000000204",
  driver5: "00000000-0000-0000-0000-000000000205",
  yard: "00000000-0000-0000-0000-000000000301",
  buschSc: "00000000-0000-0000-0000-000000000302",
  liviSc: "00000000-0000-0000-0000-000000000303",
  cookCc: "00000000-0000-0000-0000-000000000304",
  douglassSc: "00000000-0000-0000-0000-000000000305",
  nbStation: "00000000-0000-0000-0000-000000000306",
} as const;

export const HUBS: Hub[] = [
  { id: ID.yard, code: "YARD", name: "The Yard", zone: "COLLEGE_AVE", lat: 40.4998, lng: -74.4479 },
  { id: ID.buschSc, code: "BUSCH_SC", name: "Busch Student Center", zone: "BUSCH", lat: 40.5232, lng: -74.4585 },
  { id: ID.liviSc, code: "LIVI_SC", name: "Livingston Student Center", zone: "LIVINGSTON", lat: 40.524, lng: -74.4366 },
  { id: ID.cookCc, code: "COOK_CC", name: "Cook Campus Center", zone: "COOK_DOUGLASS", lat: 40.4797, lng: -74.4362 },
  { id: ID.douglassSc, code: "DOUGLASS_SC", name: "Douglass Student Center", zone: "COOK_DOUGLASS", lat: 40.4853, lng: -74.4371 },
  { id: ID.nbStation, code: "NB_STATION", name: "New Brunswick Station", zone: "DOWNTOWN", lat: 40.4966, lng: -74.4455 },
];

const UPPER: Array<[Zone, Zone, number]> = [
  ["COLLEGE_AVE", "COLLEGE_AVE", 4.5],
  ["COLLEGE_AVE", "BUSCH", 6.5],
  ["COLLEGE_AVE", "LIVINGSTON", 6.5],
  ["COLLEGE_AVE", "COOK_DOUGLASS", 6.5],
  ["COLLEGE_AVE", "DOWNTOWN", 4.5],
  ["BUSCH", "BUSCH", 4.5],
  ["BUSCH", "LIVINGSTON", 5.5],
  ["BUSCH", "COOK_DOUGLASS", 8.5],
  ["BUSCH", "DOWNTOWN", 6.5],
  ["LIVINGSTON", "LIVINGSTON", 4.5],
  ["LIVINGSTON", "COOK_DOUGLASS", 8.5],
  ["LIVINGSTON", "DOWNTOWN", 6.5],
  ["COOK_DOUGLASS", "COOK_DOUGLASS", 4.5],
  ["COOK_DOUGLASS", "DOWNTOWN", 5.5],
  ["DOWNTOWN", "DOWNTOWN", 4.5],
];

export function farePrice(from: Zone, to: Zone): number {
  const row = UPPER.find(([a, b]) => (a === from && b === to) || (a === to && b === from));
  if (!row) throw new Error(`No fare for ${from} -> ${to}`);
  return row[2];
}

export interface MockUser extends Omit<User, "isDriverApproved"> {
  createdAt: string;
}

export const USERS: MockUser[] = [
  { id: ID.rider1, email: "rider1@scarletmail.rutgers.edu", name: "Jordan Patel", phone: "732-555-0101", mode: "RIDER", ratingAvg: 4.95, ratingCount: 21, createdAt: "2026-09-01T12:00:00Z" },
  { id: ID.rider2, email: "rider2@scarletmail.rutgers.edu", name: "Sam Rivera", phone: "732-555-0102", mode: "RIDER", ratingAvg: 4.8, ratingCount: 9, createdAt: "2026-09-01T12:00:00Z" },
  { id: ID.driver1, email: "driver1@scarletmail.rutgers.edu", name: "Alex Kim", phone: "732-555-0201", mode: "DRIVER", ratingAvg: 4.92, ratingCount: 134, createdAt: "2026-08-01T12:00:00Z" },
  { id: ID.driver2, email: "driver2@scarletmail.rutgers.edu", name: "Maya Johnson", phone: "732-555-0202", mode: "DRIVER", ratingAvg: 4.97, ratingCount: 212, createdAt: "2026-08-01T12:00:00Z" },
  { id: ID.driver3, email: "driver3@scarletmail.rutgers.edu", name: "Chris Nguyen", phone: "732-555-0203", mode: "DRIVER", ratingAvg: 4.85, ratingCount: 76, createdAt: "2026-08-01T12:00:00Z" },
  { id: ID.driver4, email: "driver4@scarletmail.rutgers.edu", name: "Priya Shah", phone: "732-555-0204", mode: "DRIVER", ratingAvg: 4.99, ratingCount: 158, createdAt: "2026-08-01T12:00:00Z" },
  { id: ID.driver5, email: "driver5@scarletmail.rutgers.edu", name: "Marcus Lee", phone: "732-555-0205", mode: "DRIVER", ratingAvg: 4.88, ratingCount: 97, createdAt: "2026-08-01T12:00:00Z" },
];

const dp = (userId: string, license: string, make: string, model: string, color: string, plate: string, lat: number, lng: number): DriverProfile => ({
  userId, licenseNumber: license, carMake: make, carModel: model, carColor: color, plate, status: "APPROVED", isOnline: true, lat, lng,
});

export const DRIVER_PROFILES: DriverProfile[] = [
  dp(ID.driver1, "K2041 38211 07154", "Honda", "Civic", "Blue", "R23-HKP", 40.5004, -74.4471),
  dp(ID.driver2, "J6372 90145 22381", "Toyota", "Camry", "Silver", "S81-MTW", 40.5226, -74.4577),
  dp(ID.driver3, "N1198 47302 91046", "Hyundai", "Elantra", "White", "K56-BNX", 40.5233, -74.4378),
  dp(ID.driver4, "S5520 13987 64420", "Toyota", "Prius", "Gray", "T09-LRV", 40.4804, -74.4351),
  dp(ID.driver5, "L3307 66518 30992", "Honda", "Accord", "Black", "M74-GDC", 40.4972, -74.4463),
];

export type Behavior = "SUCCESS" | DeclineCode;

export interface VaultEntry {
  token: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  walletType: WalletType | null;
  behavior: Behavior;
}

export const VAULT: VaultEntry[] = [
  { token: "tok_seed_rider1_visa", brand: "VISA", last4: "4242", expMonth: 12, expYear: 2030, walletType: null, behavior: "SUCCESS" },
  { token: "tok_seed_rider1_applepay", brand: "VISA", last4: "8431", expMonth: 11, expYear: 2031, walletType: "APPLE_PAY", behavior: "SUCCESS" },
  { token: "tok_seed_rider2_mc", brand: "MASTERCARD", last4: "4444", expMonth: 9, expYear: 2029, walletType: null, behavior: "SUCCESS" },
  { token: "tok_seed_rider2_oldcard", brand: "VISA", last4: "0002", expMonth: 6, expYear: 2028, walletType: null, behavior: "CARD_DECLINED" },
  ...[1, 2, 3, 4, 5].map((n): VaultEntry => ({ token: `tok_seed_driver${n}_debit`, brand: "VISA", last4: "5556", expMonth: 3, expYear: 2030, walletType: null, behavior: "SUCCESS" })),
];

export interface MockPaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  nickname: string | null;
  isDefault: boolean;
  gatewayToken: string;
  createdAt: string;
  deletedAt: string | null;
}

const pm = (id: string, userId: string, type: PaymentMethodType, brand: CardBrand, last4: string, expMonth: number, expYear: number, nickname: string | null, isDefault: boolean, gatewayToken: string, createdAt: string): MockPaymentMethod => ({
  id, userId, type, brand, last4, expMonth, expYear, nickname, isDefault, gatewayToken, createdAt, deletedAt: null,
});

export const PAYMENT_METHODS: MockPaymentMethod[] = [
  pm("00000000-0000-0000-0000-000000000401", ID.rider1, "CARD", "VISA", "4242", 12, 2030, null, true, "tok_seed_rider1_visa", "2026-09-10T12:00:00Z"),
  pm("00000000-0000-0000-0000-000000000402", ID.rider1, "APPLE_PAY", "VISA", "8431", 11, 2031, null, false, "tok_seed_rider1_applepay", "2026-09-20T12:00:00Z"),
  pm("00000000-0000-0000-0000-000000000403", ID.rider2, "CARD", "MASTERCARD", "4444", 9, 2029, null, true, "tok_seed_rider2_mc", "2026-09-10T12:00:00Z"),
  pm("00000000-0000-0000-0000-000000000404", ID.rider2, "CARD", "VISA", "0002", 6, 2028, "Old card", false, "tok_seed_rider2_oldcard", "2026-03-25T12:00:00Z"),
  ...[1, 2, 3, 4, 5].map((n) =>
    pm(`00000000-0000-0000-0000-00000000041${n}`, `00000000-0000-0000-0000-00000000020${n}`, "CARD", "VISA", "5556", 3, 2030, "Debit card", true, `tok_seed_driver${n}_debit`, "2026-08-11T12:00:00Z"),
  ),
];

export interface MockCreditTxn {
  id: string;
  userId: string;
  rideId: string | null;
  type: CreditTxnType;
  amount: number;
  createdAt: string;
}

export const CREDIT_TXNS: MockCreditTxn[] = [
  { id: "00000000-0000-0000-0000-000000000501", userId: ID.rider1, rideId: null, type: "PROMO", amount: 5, createdAt: "2026-10-01T12:00:00Z" },
];

export interface MockEarning {
  id: string;
  driverId: string;
  rideId: string | null;
  type: EarningTxnType;
  amount: number;
  paymentMethodId: string | null;
  createdAt: string;
}
