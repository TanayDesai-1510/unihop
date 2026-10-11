// Mock of the /mockpay/v1 processor (contract section 5): tokenization rules and test-card behaviors.
import { cvcLength, detectBrand, digitsOnly, expectedLength, expiryValid, luhnValid } from "@/lib/cards";
import { ApiRequestError } from "@/lib/session";
import type { CardToken, TokenizeCardBody, WalletType } from "@/lib/types";
import type { Behavior, VaultEntry } from "./data";

/** Test numbers whose authorize behavior is fixed by the contract. */
export const TEST_CARD_BEHAVIOR: Record<string, Behavior> = {
  "4000000000000002": "CARD_DECLINED",
  "4000000000009995": "INSUFFICIENT_FUNDS",
  "4000000000000069": "EXPIRED_CARD",
  "4000000000000127": "INCORRECT_CVC",
};

const bad = (code: string, message: string) => new ApiRequestError(400, { error: code, message });

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Validates like the real processor and returns a vault entry. Never keeps the number or CVC. */
export function tokenize(body: TokenizeCardBody): VaultEntry {
  const number = digitsOnly(body.number ?? "");
  const brand = detectBrand(number);
  if (!brand || number.length !== expectedLength(brand) || !luhnValid(number)) {
    throw bad("INVALID_NUMBER", "Your card number is invalid.");
  }
  if (!expiryValid(Number(body.expMonth), Number(body.expYear))) {
    throw bad("INVALID_EXPIRY", "Your card's expiration date is invalid.");
  }
  const cvc = digitsOnly(body.cvc ?? "");
  if (cvc.length !== cvcLength(brand) || cvc.length !== (body.cvc ?? "").length) {
    throw bad("INVALID_CVC", "Your card's security code is invalid.");
  }
  const expYear = Number(body.expYear) < 100 ? 2000 + Number(body.expYear) : Number(body.expYear);
  return {
    token: randomToken("tok"),
    brand,
    last4: number.slice(-4),
    expMonth: Number(body.expMonth),
    expYear,
    walletType: null,
    behavior: TEST_CARD_BEHAVIOR[number] ?? "SUCCESS",
  };
}

export function walletToken(walletType: WalletType): VaultEntry {
  const now = new Date();
  return {
    token: randomToken("tok"),
    brand: "VISA",
    last4: String(Math.floor(1000 + Math.random() * 9000)),
    expMonth: now.getMonth() + 1,
    expYear: now.getFullYear() + 4,
    walletType,
    behavior: "SUCCESS",
  };
}

export function toCardToken(v: VaultEntry): CardToken {
  return { token: v.token, brand: v.brand, last4: v.last4, expMonth: v.expMonth, expYear: v.expYear, walletType: v.walletType };
}

export function newChargeId(): string {
  return randomToken("pi");
}
