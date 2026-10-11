import type { DeclineCode } from "@/lib/types";

/** What to tell people when a charge is declined. Never show the backend message; it's for logs. */
export const DECLINE_COPY: Record<DeclineCode, string> = {
  CARD_DECLINED: "Your card was declined. Try another payment method.",
  INSUFFICIENT_FUNDS: "Your card has insufficient funds. Try another payment method.",
  EXPIRED_CARD: "Your card has expired. Try another payment method.",
  INCORRECT_CVC: "Your card's security code didn't match. Try another payment method.",
};

/** Copy for a 402 PAYMENT_DECLINED; falls back to the generic decline when the code is missing. */
export function declineMessage(declineCode: DeclineCode | null | undefined): string {
  return DECLINE_COPY[declineCode ?? "CARD_DECLINED"] ?? DECLINE_COPY.CARD_DECLINED;
}
