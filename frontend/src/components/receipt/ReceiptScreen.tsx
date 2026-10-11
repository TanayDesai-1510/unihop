"use client";

import { ArrowLeft, Check, Clock3, Star } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { homeFor, useSession } from "@/components/app/SessionProvider";
import { Price } from "@/components/brand/Price";
import { HeroSurface, TicketCard } from "@/components/brand/Road";
import { RouteSummary } from "@/components/rider/parts";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { pressable, springHop } from "@/lib/motion";
import type { Receipt } from "@/lib/types";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
const mins = (s: number | null) => (s == null ? null : s < 60 ? `${s} sec` : `${Math.round(s / 60)} min`);

/** Trip receipt (issue #39): rider sees what they paid, driver what they earned, both see the split. */
export function ReceiptScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stars, setStars] = useState(0);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getReceipt(id)
      .then((r) => !cancelled && setReceipt(r))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof ApiRequestError && e.status === 404
            ? "This receipt isn't ready. Receipts appear once the ride is complete."
            : e instanceof ApiRequestError && e.status === 403
              ? "This receipt belongs to someone else's ride."
              : "We couldn't load this receipt. Check your connection and try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  // Driver if the session's name is the receipt's driver (receipts carry names, not roles).
  const asDriver = !!(receipt && user && user.mode === "DRIVER" && receipt.driverName === user.name);
  const other = receipt ? (asDriver ? receipt.riderName : receipt.driverName) : "";
  const back = user ? homeFor(user.mode) : "/rider";

  const rate = async (n: 1 | 2 | 3 | 4 | 5) => {
    if (rated) return;
    setStars(n);
    haptic("tick");
    try {
      await api.rateRide(id, { stars: n });
      setRated(true);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "ALREADY_RATED") setRated(true);
      else toast.show({ tone: "error", message: "Couldn't save your rating. Try again." });
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-bg">
      <HeroSurface className="px-5 pb-14 pt-[calc(env(safe-area-inset-top)+12px)]">
        <motion.div {...pressable} className="-ml-2 inline-flex">
          <Link href={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-full text-on-brand">
            <ArrowLeft aria-hidden size={22} strokeWidth={2} />
          </Link>
        </motion.div>
        <div className="mt-3 flex items-center gap-3">
          {!error && (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springHop} className="flex size-10 items-center justify-center rounded-full bg-success text-on-brand">
              <Check aria-hidden size={22} strokeWidth={3} />
            </motion.span>
          )}
          <div className="min-w-0">
            <p className="eyebrow text-on-brand/70">Trip receipt</p>
            <p className="truncate text-label font-normal text-on-brand/80">{receipt ? when(receipt.completedAt) : " "}</p>
          </div>
        </div>
        {!error && (
          <>
            <p className="mt-6 text-label font-normal text-on-brand/75">{asDriver ? "You earned" : "You paid"}</p>
            {receipt ? (
              <Price amount={asDriver ? receipt.fare.driverPayout : receipt.payment.amountTotal || receipt.fare.total} size="hero" countUp />
            ) : (
              <Skeleton className="mt-1 h-12 w-40 bg-on-brand/15" />
            )}
          </>
        )}
      </HeroSurface>

      <div className="relative -mt-8 flex flex-col gap-5 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {error ? (
          <div className="rounded-card bg-surface-raised shadow-[var(--shadow-float)]">
            <ErrorState message={error} onRetry={retry} />
          </div>
        ) : !receipt ? (
          <div className="flex flex-col gap-3 rounded-card bg-surface-raised p-5 shadow-[var(--shadow-float)]">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-52" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <>
            <TicketCard
              top={
                <div className="flex flex-col gap-3">
                  <RouteSummary pickup={{ name: receipt.pickupHubName }} dropoff={{ name: receipt.dropoffHubName }} />
                  <p className="flex items-center gap-1.5 text-label font-normal text-ink-muted">
                    <Clock3 aria-hidden size={16} strokeWidth={2} />
                    {[mins(receipt.durationSeconds), receipt.startedAt && `started ${new Date(receipt.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`].filter(Boolean).join(" · ") || "Duration unavailable"}
                  </p>
                </div>
              }
              bottom={
                <dl className="flex flex-col gap-2 text-label">
                  <Row label="Rider paid" value={`$${receipt.fare.total.toFixed(2)}`} />
                  <Row label="Platform & safety fee" value={`$${receipt.fare.platformFee.toFixed(2)}`} />
                  <Row label={asDriver ? "You earn" : `${receipt.driverName.split(" ")[0]} earns`} value={`$${receipt.fare.driverPayout.toFixed(2)}`} strong={asDriver} success />
                  <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
                    {receipt.payment.creditsApplied > 0 && <Row label="UniHop Cash" value={`-$${receipt.payment.creditsApplied.toFixed(2)}`} />}
                    {receipt.payment.cardAmount > 0 && <Row label="Charged to card" value={`$${receipt.payment.cardAmount.toFixed(2)}`} />}
                    <Row label="Paid with" value={receipt.payment.methodLabel || "UniHop Cash"} />
                  </div>
                </dl>
              }
            />
            <p className="text-center text-label font-normal text-ink-muted">
              {asDriver ? "Rider" : "Driver"}: <span className="text-ink">{other}</span>
            </p>
            <div className="flex flex-col items-center gap-2">
              <p className="text-headline text-ink">{rated ? `Thanks for rating ${other.split(" ")[0]}` : `How was ${other.split(" ")[0]}?`}</p>
              <div className="flex gap-1" role="radiogroup" aria-label={`Rate ${other}`}>
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <motion.button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    disabled={rated}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => rate(n)}
                    className="flex size-12 items-center justify-center"
                  >
                    <Star aria-hidden size={32} strokeWidth={1.75} className={cn(stars >= n ? "fill-warning text-warning" : "text-line")} />
                  </motion.button>
                ))}
              </div>
            </div>
            <Button variant="primary" onClick={() => router.push(back)}>
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong, success }: { label: string; value: string; strong?: boolean; success?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={cn(strong ? "text-ink" : "font-normal text-ink-muted")}>{label}</dt>
      <dd className={cn("tnum text-right", success ? "font-semibold text-success" : "text-ink")}>{value}</dd>
    </div>
  );
}
