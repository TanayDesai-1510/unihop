// Card helpers per contract section 5. Used by the add-card screen and by the mock processor.
import type { CardBrand, PaymentMethodType } from "./types";

export const BRAND_NAMES: Record<CardBrand, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  AMEX: "Amex",
  DISCOVER: "Discover",
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Brand from prefix: 4 VISA; 51-55, 2221-2720 MASTERCARD; 34/37 AMEX; 6011, 65, 644-649 DISCOVER. */
export function detectBrand(number: string): CardBrand | null {
  const d = digitsOnly(number);
  if (/^4/.test(d)) return "VISA";
  if (/^5[1-5]/.test(d)) return "MASTERCARD";
  const four = Number(d.slice(0, 4));
  if (d.length >= 4 && four >= 2221 && four <= 2720) return "MASTERCARD";
  if (/^3[47]/.test(d)) return "AMEX";
  if (/^(6011|65|64[4-9])/.test(d)) return "DISCOVER";
  return null;
}

export function expectedLength(brand: CardBrand | null): number {
  return brand === "AMEX" ? 15 : 16;
}

export function cvcLength(brand: CardBrand | null): number {
  return brand === "AMEX" ? 4 : 3;
}

/** "4242424242424242" -> "4242 4242 4242 4242"; Amex groups 4-6-5. */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19);
  if (detectBrand(d) === "AMEX") {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  }
  return d.replace(/(.{4})/g, "$1 ").trim();
}

/** Expiry is valid through the end of its month. */
export function expiryValid(expMonth: number, expYear: number, now = new Date()): boolean {
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) return false;
  const year = expYear < 100 ? 2000 + expYear : expYear;
  const endOfMonth = new Date(year, expMonth, 1);
  return endOfMonth > now;
}

/** Contract label format: "Visa •••• 4242", "Apple Pay", "Google Pay". */
export function paymentMethodLabel(type: PaymentMethodType, brand: CardBrand, last4: string): string {
  if (type === "APPLE_PAY") return "Apple Pay";
  if (type === "GOOGLE_PAY") return "Google Pay";
  return `${BRAND_NAMES[brand]} •••• ${last4}`;
}
