"use client";

import { ArrowLeft, Lock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { HopIn } from "@/components/brand/Hop";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { BRAND_NAMES, cvcLength, detectBrand, digitsOnly, expectedLength, expiryValid, formatCardNumber, luhnValid } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { pressable, springSmooth } from "@/lib/motion";
import type { CardBrand } from "@/lib/types";

const ART: Record<CardBrand | "UNKNOWN", string> = {
  UNKNOWN: "var(--card-art-unknown)",
  VISA: "var(--card-art-visa)",
  MASTERCARD: "var(--card-art-mastercard)",
  AMEX: "var(--card-art-amex)",
  DISCOVER: "var(--card-art-discover)",
};

/** Demo test cards from the contract (section 5). Tokenization succeeds; declines happen on use. */
const TEST_CARDS = [
  { label: "Visa 4242", number: "4242424242424242", cvc: "123" },
  { label: "MC 4444", number: "5555555555554444", cvc: "123" },
  { label: "Amex", number: "378282246310005", cvc: "1234" },
  { label: "Declines: 0002", number: "4000000000000002", cvc: "123" },
];

type Field = "number" | "expiry" | "cvc";

function parseExpiry(v: string): { month: number; year: number } | null {
  const m = v.match(/^(\d{2})\/(\d{2})$/);
  return m ? { month: Number(m[1]), year: 2000 + Number(m[2]) } : null;
}

/** Add card (issue #41): live card preview, brand detection, validation, tokenize at mockpay, then save. */
export function AddCardScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [nickname, setNickname] = useState("");
  const [cvcFocused, setCvcFocused] = useState(false);
  const [touched, setTouched] = useState<Record<Field, boolean>>({ number: false, expiry: false, cvc: false });
  const [serverError, setServerError] = useState<{ field: Field | "form"; message: string } | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);

  const digits = digitsOnly(number);
  const brand = detectBrand(digits);
  const exp = parseExpiry(expiry);

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    if (!brand) e.number = digits.length ? "We accept Visa, Mastercard, Amex and Discover." : "Enter your card number.";
    else if (digits.length !== expectedLength(brand) || !luhnValid(digits)) e.number = "That card number isn't valid. Check the digits.";
    if (!exp || !expiryValid(exp.month, exp.year)) e.expiry = expiry ? "Enter a future date as MM/YY." : "Enter the expiry date.";
    if (cvc.length !== cvcLength(brand)) e.cvc = `Enter the ${cvcLength(brand)}-digit security code.`;
    return e;
  }, [brand, digits, exp, expiry, cvc]);
  const valid = Object.keys(errors).length === 0;
  const fieldError = (f: Field) => (serverError?.field === f ? serverError.message : touched[f] ? errors[f] : null);

  const fill = (n: string, c: string) => {
    setNumber(formatCardNumber(n));
    const d = new Date();
    setExpiry(`${String(d.getMonth() + 1).padStart(2, "0")}/${String((d.getFullYear() + 3) % 100).padStart(2, "0")}`);
    setCvc(c);
    setServerError(null);
    haptic("tick");
  };

  const save = async () => {
    setTouched({ number: true, expiry: true, cvc: true });
    if (!valid || !exp || busy) {
      haptic("error");
      setTries((n) => n + 1);
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      // The raw number and CVC go ONLY to the mock processor (contract section 5); /api gets a token.
      const token = await api.tokenizeCard({ number: digits, expMonth: exp.month, expYear: exp.year, cvc });
      const method = await api.addPaymentMethod({ token: token.token, nickname: nickname.trim() || undefined });
      haptic("success");
      toast.show({ tone: "success", message: `${method.label} saved${method.isDefault ? " as your default" : ""}.` });
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/payment");
    } catch (e) {
      haptic("error");
      setTries((n) => n + 1);
      const code = e instanceof ApiRequestError ? e.code : "";
      if (code === "INVALID_NUMBER") setServerError({ field: "number", message: "That card number isn't valid. Check the digits." });
      else if (code === "INVALID_EXPIRY") setServerError({ field: "expiry", message: "That expiry date isn't valid." });
      else if (code === "INVALID_CVC") setServerError({ field: "cvc", message: "That security code isn't valid." });
      else if (code === "DUPLICATE_PAYMENT_METHOD") setServerError({ field: "form", message: "You've already saved this card." });
      else setServerError({ field: "form", message: "Couldn't save your card. Try again." });
      setBusy(false);
    }
  };

  // Preview number: typed digits, the rest as dots, grouped like the real card (Amex 4-6-5).
  const groups = brand === "AMEX" ? [4, 6, 5] : [4, 4, 4, 4];
  const padded = digits.slice(0, expectedLength(brand)).padEnd(expectedLength(brand), "•");
  let cursor = 0;
  const shownNumber = groups.map((g) => padded.slice(cursor, (cursor += g))).join(" ");

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-bg">
      <header className="flex items-center gap-1 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        <motion.div {...pressable}>
          <Link href={params.get("next") ?? "/payment"} aria-label="Back" className="flex size-11 items-center justify-center rounded-full text-ink">
            <ArrowLeft aria-hidden size={22} strokeWidth={2} />
          </Link>
        </motion.div>
        <h1 className="text-title text-ink">Add card</h1>
      </header>

      <div className="flex flex-col gap-6 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        {/* Live preview: flips to the back while the CVC is focused. */}
        <div className="[perspective:1200px]" aria-hidden>
          <motion.div
            className="relative h-[200px] w-full [transform-style:preserve-3d]"
            animate={{ rotateY: cvcFocused && !reduce ? 180 : 0 }}
            transition={springSmooth}
          >
            <div
              className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[18px] p-5 text-[var(--card-art-ink)] shadow-[var(--shadow-lift)] transition-[background-color] duration-300 [backface-visibility:hidden]"
              style={{ backgroundColor: ART[brand ?? "UNKNOWN"], backgroundImage: "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.16), transparent 55%)" }}
            >
              <div className="flex items-start justify-between">
                <span className="h-8 w-11 rounded-[6px] bg-[image:var(--card-chip)] opacity-90" />
                <motion.span key={brand ?? "none"} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={springSmooth} className="text-headline font-bold tracking-[0.04em]">
                  {brand ? BRAND_NAMES[brand].toUpperCase() : "CARD"}
                </motion.span>
              </div>
              <p className="font-mono-num text-[22px] tracking-[0.08em]">{shownNumber}</p>
              <div className="flex items-end justify-between text-label">
                <span className="opacity-80">{nickname.trim() || "Your card"}</span>
                <span className="font-mono-num">{expiry || "MM/YY"}</span>
              </div>
            </div>
            <div
              className="absolute inset-0 overflow-hidden rounded-[18px] text-[var(--card-art-ink)] shadow-[var(--shadow-lift)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ backgroundColor: ART[brand ?? "UNKNOWN"] }}
            >
              <div className="mt-7 h-11 w-full bg-[var(--card-stripe)]" />
              <div className="mx-5 mt-5 flex items-center justify-end gap-3">
                <span className="h-9 flex-1 rounded-[4px] bg-[var(--card-signature)]" />
                <span className="flex h-9 w-16 items-center justify-center rounded-[4px] bg-[var(--card-signature)] font-mono-num text-[var(--card-art-unknown)]">{cvc.padEnd(cvcLength(brand), "•")}</span>
              </div>
              <p className="mx-5 mt-4 text-caption font-medium opacity-70">{brand === "AMEX" ? "Amex: 4-digit code on the front" : "3-digit code on the back"}</p>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Demo test cards">
          {TEST_CARDS.map((t) => (
            <motion.button key={t.label} type="button" {...pressable} onClick={() => fill(t.number, t.cvc)} className="h-9 rounded-full border border-line px-3 text-caption text-ink">
              {t.label}
            </motion.button>
          ))}
        </div>

        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            label="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
            value={number}
            onChange={(e) => {
              setNumber(formatCardNumber(e.target.value));
              if (serverError?.field === "number") setServerError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, number: true }))}
            error={fieldError("number")}
            shakeKey={tries}
            className="[&_input]:font-mono-num"
            trailing={brand && <span className="text-caption font-semibold text-ink-muted">{BRAND_NAMES[brand]}</span>}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              maxLength={5}
              value={expiry}
              onChange={(e) => {
                const d = digitsOnly(e.target.value).slice(0, 4);
                setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                if (serverError?.field === "expiry") setServerError(null);
              }}
              onBlur={() => setTouched((t) => ({ ...t, expiry: true }))}
              error={fieldError("expiry")}
              shakeKey={tries}
              className="[&_input]:font-mono-num"
            />
            <Input
              label={brand === "AMEX" ? "CVC (4 digits)" : "CVC"}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={brand === "AMEX" ? "1234" : "123"}
              maxLength={cvcLength(brand)}
              value={cvc}
              onChange={(e) => {
                setCvc(digitsOnly(e.target.value).slice(0, cvcLength(brand)));
                if (serverError?.field === "cvc") setServerError(null);
              }}
              onFocus={() => setCvcFocused(true)}
              onBlur={() => {
                setCvcFocused(false);
                setTouched((t) => ({ ...t, cvc: true }));
              }}
              error={fieldError("cvc")}
              shakeKey={tries}
              className="[&_input]:font-mono-num"
            />
          </div>
          <Input label="Nickname (optional)" placeholder="e.g. Chase debit" maxLength={50} value={nickname} onChange={(e) => setNickname(e.target.value)} />
          {serverError?.field === "form" && (
            <p role="alert" className="rounded-input border border-danger px-4 py-3 text-label text-danger">
              {serverError.message}
            </p>
          )}
          <HopIn trigger={valid}>
            <Button type="submit" variant="primary" loading={busy}>
              Save card
            </Button>
          </HopIn>
          <p className={cn("flex items-center justify-center gap-1.5 text-caption font-medium text-ink-muted")}>
            <Lock aria-hidden size={14} strokeWidth={2} />
            Your card number goes straight to our payment processor. UniHop only keeps a token.
          </p>
        </form>
      </div>
    </div>
  );
}
