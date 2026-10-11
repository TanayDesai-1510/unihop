"use client";

import { Check, CircleCheck, Plus, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen } from "@/components/app/Screen";
import { useSession } from "@/components/app/SessionProvider";
import { Price } from "@/components/brand/Price";
import { HeroSurface } from "@/components/brand/Road";
import { RoadScene } from "@/components/brand/RoadScene";
import { PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonGroup, SkeletonListRow } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { pressable, springSnappy } from "@/lib/motion";
import type { Earnings, PaymentMethod } from "@/lib/types";

const money = (n: number) => `$${n.toFixed(2)}`;

type Phase = "idle" | "choose" | "sending" | "sent";

/** Earnings (issue #43): balance, today / week / all-time, recent trips, and instant cash out. */
export function EarningsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, status } = useSession();
  const [data, setData] = useState<Earnings | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<string | null>(null);
  const [sent, setSent] = useState<{ amount: number; label: string } | null>(null);

  const notDriver = status === "ready" && !!user && !user.isDriverApproved;

  useEffect(() => {
    if (notDriver) return;
    let cancelled = false;
    Promise.all([api.getEarnings(), api.listPaymentMethods()])
      .then(([e, m]) => {
        if (cancelled) return;
        setData(e);
        setMethods(m);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [attempt, notDriver]);

  // Payouts go to a card (wallets can't receive money). Default card first.
  const cards = (methods ?? []).filter((m) => m.type === "CARD").sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const target = cards.find((c) => c.id === picked) ?? cards[0] ?? null;

  const cashOut = async () => {
    if (!target || !data) return;
    setPhase("sending");
    try {
      const res = await api.cashout({ paymentMethodId: target.id });
      haptic("success");
      setSent({ amount: res.payoutAmount, label: res.methodLabel });
      setData({ ...data, balance: res.balance });
      setPhase("sent");
    } catch (e) {
      haptic("error");
      setPhase("choose");
      if (e instanceof ApiRequestError && e.code === "NOTHING_TO_CASH_OUT") {
        setData({ ...data, balance: 0 });
        setPhase("idle");
        toast.show({ tone: "info", message: "Nothing to cash out yet. Your balance is $0.00." });
      } else if (e instanceof ApiRequestError && e.code === "PAYMENT_DECLINED") {
        toast.show({ tone: "error", message: `${target.label} can't receive payouts. Pick another card.` });
      } else {
        toast.show({ tone: "error", message: "Cash out didn't go through. Your balance is unchanged. Try again." });
      }
    }
  };

  return (
    <Screen title="Earnings">
      {notDriver ? (
        <div className="flex min-h-[55dvh] items-center justify-center">
          <EmptyState
            illustration={<RoadScene variant="coins" />}
            title="Drive and earn"
            message="Keep 90% of every base fare and cash out to your card any time."
            action={{ label: "Become a driver", onClick: () => router.push("/driver/onboard") }}
          />
        </div>
      ) : error ? (
        <ErrorState
          message="We couldn't load your earnings. Check your connection and try again."
          onRetry={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : !data || !methods ? (
        <EarningsSkeleton />
      ) : (
        <div className="flex flex-col gap-8 pb-8">
          <HeroSurface className="rounded-card px-5 pb-5 pt-6">
            <AnimatePresence mode="wait" initial={false}>
              {phase === "sent" && sent ? (
                <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springSnappy} role="status">
                  <span className="flex size-12 items-center justify-center rounded-full bg-success text-white">
                    <Check aria-hidden size={26} strokeWidth={3} />
                  </span>
                  <p className="mt-4 text-title text-on-brand">{money(sent.amount)} is on its way</p>
                  <p className="mt-1 text-label font-normal text-on-brand/75">Sent instantly to {sent.label}. It can take a few minutes to show up.</p>
                  <Button variant="secondary" block className="mt-5" onClick={() => setPhase("idle")}>
                    Done
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="balance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <p className="eyebrow text-on-brand/70">Available to cash out</p>
                  <Price amount={data.balance} size="hero" countUp />
                  {data.balance > 0 && target && phase === "idle" && (
                    <p className="mt-1 flex items-center gap-1.5 text-label font-normal text-on-brand/75">
                      <Zap aria-hidden size={14} strokeWidth={2} className="shrink-0" />
                      Instant to {target.label}, no fee
                    </p>
                  )}

                  <AnimatePresence initial={false}>
                    {(phase === "choose" || phase === "sending") && (
                      <motion.fieldset
                        key="choose"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={springSnappy}
                        disabled={phase === "sending"}
                        className="mt-5 flex flex-col gap-2"
                      >
                        <legend className="eyebrow mb-2 text-on-brand/70">Send to</legend>
                        {cards.map((c) => {
                          const on = c.id === target?.id;
                          return (
                            <motion.button
                              key={c.id}
                              type="button"
                              {...pressable}
                              role="radio"
                              aria-checked={on}
                              onClick={() => {
                                haptic("tick");
                                setPicked(c.id);
                              }}
                              className={cn(
                                "flex min-h-14 items-center gap-3 rounded-card px-4 text-left transition-colors duration-150",
                                on ? "bg-white/18 ring-2 ring-white/70" : "bg-white/8",
                              )}
                            >
                              <PaymentBadge brand={c.brand} type={c.type} />
                              <span className="min-w-0 flex-1 truncate text-body font-medium text-on-brand">{c.nickname ?? c.label}</span>
                              {on && <CircleCheck aria-hidden size={22} strokeWidth={2} className="shrink-0 text-on-brand" />}
                            </motion.button>
                          );
                        })}
                      </motion.fieldset>
                    )}
                  </AnimatePresence>

                  {data.balance <= 0 ? (
                    <p className="mt-2 text-label font-normal text-on-brand/75">
                      {data.total > 0 ? "All cashed out. New trips land here as you finish them." : "Finish a trip and what you earn lands here. Cash out any time, no fee."}
                    </p>
                  ) : cards.length === 0 ? (
                    <Link
                      href="/payment/add?next=/earnings"
                      className="mt-5 flex min-h-14 items-center gap-3 rounded-card bg-white/8 px-4 text-body font-medium text-on-brand"
                    >
                      <Plus aria-hidden size={20} strokeWidth={2} />
                      Add a debit card to cash out
                    </Link>
                  ) : phase === "idle" ? (
                    <Button
                      variant="accent"
                      block
                      className="mt-5"
                      onClick={() => {
                        haptic("tick");
                        setPhase("choose");
                      }}
                    >
                      Cash out
                    </Button>
                  ) : (
                    <div className="mt-4 flex gap-3">
                      <Button variant="ghost" className="flex-1 text-on-brand" disabled={phase === "sending"} onClick={() => setPhase("idle")}>
                        Cancel
                      </Button>
                      <Button variant="accent" className="flex-[2]" loading={phase === "sending"} onClick={cashOut}>
                        Send {money(data.balance)}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </HeroSurface>

          <section aria-label="Earnings summary" className="grid grid-cols-3 gap-2">
            {(
              [
                ["Today", data.today],
                ["This week", data.week],
                ["All time", data.total],
              ] as const
            ).map(([label, amount]) => (
              <div key={label} className="rounded-card bg-surface px-3 py-3">
                <p className="text-caption font-medium text-ink-muted">{label}</p>
                <p className="tnum mt-1 truncate text-headline font-semibold text-ink">{money(amount)}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="trips-title" className="flex flex-col gap-1">
            <h2 id="trips-title" className="eyebrow text-ink-muted">
              Recent trips
            </h2>
            {data.rides.length === 0 ? (
              <p className="py-4 text-body text-ink-muted">Trips you complete show up here with what you earned.</p>
            ) : (
              <ul className="-mx-3 flex flex-col">
                {data.rides.slice(0, 20).map((r) => (
                  <li key={r.id}>
                    <Link href={`/receipt/${r.id}`} className="flex min-h-14 items-center gap-3 rounded-card px-3 py-2 transition-[background-color,transform] duration-150 ease-ui active:scale-[0.97] active:bg-surface">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">{r.dropoffHubName}</span>
                        <span className="block truncate text-label font-normal text-ink-muted">
                          {new Date(r.completedAt ?? r.requestedAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} · From {r.pickupHubName}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-headline font-semibold text-success">+{money(r.driverPayout)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Screen>
  );
}

function EarningsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading earnings" className="flex flex-col gap-8">
      <Skeleton rounded="card" className="h-52 w-full" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} rounded="card" className="h-[72px]" />
        ))}
      </div>
      <SkeletonGroup label="Loading trips" className="-mx-3">
        {[0, 1, 2].map((i) => (
          <SkeletonListRow key={i} />
        ))}
      </SkeletonGroup>
    </div>
  );
}
