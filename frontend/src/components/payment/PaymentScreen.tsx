"use client";

import { Check, CreditCard, Gift, MoreHorizontal, Plus, RotateCcw, Smartphone, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Screen } from "@/components/app/Screen";
import { Price } from "@/components/brand/Price";
import { RoadScene } from "@/components/brand/RoadScene";
import { PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonListRow, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { pressable, springSmooth } from "@/lib/motion";
import type { CreditTransaction, Credits, PaymentMethod, TopupAmount, WalletType } from "@/lib/types";
import { availableWallets, WalletSheet } from "./WalletSheet";
import { declineMessage } from "./declines";

const TXN_LABEL: Record<CreditTransaction["type"], string> = {
  PROMO: "Promo credit",
  TOPUP: "Added funds",
  RIDE_SPEND: "Ride",
  RIDE_REFUND: "Ride refund",
};

const expiry = (m: PaymentMethod) => `${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}`;

/** Payment (issue #40): UniHop Cash on top, saved methods, add method, credits history. */
export function PaymentScreen() {
  const router = useRouter();
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [topupOpen, setTopupOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [selected, setSelected] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listPaymentMethods(), api.getCredits()])
      .then(([m, c]) => {
        if (cancelled) return;
        setMethods(m);
        setCredits(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);

  const refreshMethods = useCallback(() => api.listPaymentMethods().then(setMethods).catch(() => {}), []);

  return (
    <Screen title="Payment">
      {error ? (
        <ErrorState message="We couldn't load your payment methods. Check your connection and try again." onRetry={reload} />
      ) : (
        <div className="flex flex-col gap-7">
          {/* UniHop Cash */}
          <section aria-labelledby="cash-title" className="hero-surface relative overflow-hidden rounded-card p-5 text-on-brand shadow-[var(--shadow-lift)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id="cash-title" className="eyebrow text-on-brand/70">
                  UniHop Cash
                </p>
                {credits ? <Price amount={credits.balance} size="hero" countUp className="mt-1" /> : <Skeleton className="mt-2 h-12 w-36 bg-on-brand/15" />}
              </div>
              <Wallet aria-hidden size={28} strokeWidth={1.75} className="text-on-brand/60" />
            </div>
            <p className="mt-2 text-label font-normal text-on-brand/75">Applied first on every ride. Never expires.</p>
            <motion.button
              type="button"
              {...pressable}
              onClick={() => setTopupOpen(true)}
              disabled={!methods}
              className="mt-4 flex h-11 items-center gap-2 rounded-full bg-on-brand px-4 text-label font-semibold text-brand-logo disabled:opacity-50"
            >
              <Plus aria-hidden size={18} strokeWidth={2.5} />
              Add funds
            </motion.button>
          </section>

          {/* Saved methods */}
          <section aria-labelledby="methods-title" className="flex flex-col gap-2">
            <h2 id="methods-title" className="eyebrow text-ink-muted">
              Payment methods
            </h2>
            <div className="-mx-3 flex flex-col">
              {!methods ? (
                <>
                  <SkeletonListRow />
                  <SkeletonListRow />
                </>
              ) : methods.length === 0 ? (
                <EmptyState illustration={<RoadScene variant="ticket" className="h-20" />} title="No cards yet" message="Add a card or wallet to pay for rides beyond your UniHop Cash." />
              ) : (
                <AnimatePresence initial={false}>
                  {methods.map((m) => (
                    <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }} transition={springSmooth}>
                      <ListRow
                        leading={<PaymentBadge brand={m.brand} type={m.type} />}
                        title={m.nickname ? `${m.nickname} · ${m.label}` : m.label}
                        subtitle={`${m.type === "CARD" ? `Expires ${expiry(m)}` : `Wallet · ${m.brand === "VISA" ? "Visa" : m.brand.charAt(0) + m.brand.slice(1).toLowerCase()} •••• ${m.last4}`}${m.isDefault ? " · Default" : ""}`}
                        trailing={
                          m.isDefault ? (
                            <span className="flex size-7 items-center justify-center rounded-full bg-brand text-on-brand" aria-label="Default method">
                              <Check aria-hidden size={16} strokeWidth={3} />
                            </span>
                          ) : (
                            <MoreHorizontal aria-hidden size={20} strokeWidth={2} className="text-ink-muted" />
                          )
                        }
                        onClick={() => setSelected(m)}
                        aria-label={`${m.label}${m.isDefault ? ", default" : ""}. Options`}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <ListRow leading={<Plus aria-hidden size={20} strokeWidth={2} />} title="Add payment method" subtitle="Card, Apple Pay or Google Pay" chevron onClick={() => setAddOpen(true)} />
            </div>
          </section>

          {/* History */}
          <section aria-labelledby="history-title" className="flex flex-col gap-2">
            <h2 id="history-title" className="eyebrow text-ink-muted">
              UniHop Cash activity
            </h2>
            {!credits ? (
              <div className="-mx-3">
                <SkeletonListRow />
              </div>
            ) : credits.transactions.length === 0 ? (
              <p className="py-4 text-label font-normal text-ink-muted">No activity yet. Add funds or redeem a promo to get started.</p>
            ) : (
              <ul className="-mx-3 flex flex-col">
                {credits.transactions.map((t) => (
                  <li key={t.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                      {t.type === "PROMO" ? <Gift aria-hidden size={20} strokeWidth={2} /> : t.type === "TOPUP" ? <Plus aria-hidden size={20} strokeWidth={2} /> : t.type === "RIDE_REFUND" ? <RotateCcw aria-hidden size={20} strokeWidth={2} /> : <CreditCard aria-hidden size={20} strokeWidth={2} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body text-ink">{TXN_LABEL[t.type]}</span>
                      <span className="block text-label font-normal text-ink-muted">{new Date(t.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </span>
                    <span className={cn("tnum text-body font-semibold", t.amount > 0 ? "text-success" : "text-ink")}>
                      {t.amount > 0 ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <TopupSheet
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        methods={methods ?? []}
        onDone={(c) => {
          setCredits(c);
          setTopupOpen(false);
        }}
        onAddCard={() => {
          setTopupOpen(false);
          router.push("/payment/add");
        }}
      />

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add payment method">
        <div className="-mx-3 flex flex-col">
          <ListRow leading={<CreditCard aria-hidden size={20} strokeWidth={2} />} title="Credit or debit card" subtitle="Visa, Mastercard, Amex, Discover" chevron onClick={() => router.push("/payment/add")} />
          {availableWallets().map((w) => (
            <ListRow
              key={w}
              leading={<Smartphone aria-hidden size={20} strokeWidth={2} />}
              title={w === "APPLE_PAY" ? "Apple Pay" : "Google Pay"}
              chevron
              onClick={() => {
                setAddOpen(false);
                setWallet(w);
              }}
            />
          ))}
        </div>
      </Sheet>

      <WalletSheet
        walletType={wallet}
        onClose={() => setWallet(null)}
        onAdded={(m) => {
          setWallet(null);
          toast.show({ tone: "success", message: `${m.label} is ready to use.` });
          refreshMethods();
        }}
      />

      <MethodSheet
        method={selected}
        onClose={() => setSelected(null)}
        onChanged={(next) => {
          setMethods(next);
          setSelected(null);
        }}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- top-up

function TopupSheet({ open, onClose, methods, onDone, onAddCard }: { open: boolean; onClose: () => void; methods: PaymentMethod[]; onDone: (c: Credits) => void; onAddCard: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState<TopupAmount>(20);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const method = methods.find((m) => m.id === methodId) ?? methods.find((m) => m.isDefault) ?? methods[0];

  const submit = async () => {
    if (!method || busy) return;
    setBusy(true);
    setError(null);
    try {
      const c = await api.topupCredits({ amount, paymentMethodId: method.id });
      haptic("success");
      toast.show({ tone: "success", message: `$${amount.toFixed(2)} added to UniHop Cash.` });
      onDone(c);
    } catch (e) {
      haptic("error");
      setError(e instanceof ApiRequestError && e.code === "PAYMENT_DECLINED" ? declineMessage(e.declineCode) : "Couldn't add funds. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add funds" description="Charged to your card right away. Used before your card on every ride.">
      {methods.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-label font-normal text-ink-muted">Add a card first to top up UniHop Cash.</p>
          <Button variant="primary" onClick={onAddCard}>
            Add a card
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div role="radiogroup" aria-label="Amount" className="grid grid-cols-3 gap-2">
            {([10, 20, 50] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                role="radio"
                aria-checked={amount === a}
                {...pressable}
                onClick={() => {
                  setAmount(a);
                  haptic("tick");
                }}
                className={cn("flex h-16 items-center justify-center rounded-card", amount === a ? "bg-brand text-on-brand" : "bg-surface text-ink")}
              >
                <Price amount={a} size="title" animated={false} />
              </motion.button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-label text-ink">Pay with</p>
            <div className="-mx-3 flex flex-col">
              {methods.map((m) => (
                <ListRow
                  key={m.id}
                  leading={<PaymentBadge brand={m.brand} type={m.type} />}
                  title={m.label}
                  selected={m.id === method?.id}
                  trailing={m.id === method?.id ? <Check aria-hidden size={20} strokeWidth={2.5} className="text-brand" /> : undefined}
                  onClick={() => {
                    setMethodId(m.id);
                    setError(null);
                  }}
                />
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-input border border-danger px-4 py-3 text-label text-danger">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={submit} loading={busy}>
            Add ${amount.toFixed(2)}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- method actions

function MethodSheet({ method, onClose, onChanged }: { method: PaymentMethod | null; onClose: () => void; onChanged: (methods: PaymentMethod[]) => void }) {
  const toast = useToast();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState<"default" | "nickname" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  // Reset the form when a different method is opened (adjusted during render, not in an effect).
  if (method && method.id !== current) {
    setCurrent(method.id);
    setNickname(method.nickname ?? "");
    setError(null);
  }

  const run = async (kind: "default" | "nickname" | "delete") => {
    if (!method || busy) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "delete") await api.deletePaymentMethod(method.id);
      else await api.updatePaymentMethod(method.id, kind === "default" ? { isDefault: true } : { nickname: nickname.trim() });
      const next = await api.listPaymentMethods();
      haptic(kind === "delete" ? "tick" : "success");
      toast.show({ tone: "success", message: kind === "delete" ? `${method.label} removed.` : kind === "default" ? `${method.label} is now your default.` : "Nickname saved." });
      onChanged(next);
    } catch (e) {
      haptic("error");
      setError(e instanceof ApiRequestError && e.code === "PAYMENT_METHOD_IN_USE" ? "This method is holding a payment for an active ride. Try again after the ride." : e instanceof ApiRequestError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={!!method} onClose={onClose} title={method?.label} description={method?.type === "CARD" ? `Expires ${method ? expiry(method) : ""}` : method ? "Wallet" : undefined}>
      {method && (
        <div className="flex flex-col gap-4">
          {!method.isDefault && (
            <Button variant="secondary" onClick={() => run("default")} loading={busy === "default"} leadingIcon={<Check aria-hidden size={18} strokeWidth={2.5} />}>
              Make default
            </Button>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run("nickname");
            }}
          >
            <Input label="Nickname" placeholder="e.g. Debit card" value={nickname} maxLength={50} onChange={(e) => setNickname(e.target.value)} className="flex-1" />
            <Button type="submit" variant="primary" size="md" block={false} className="mb-1 h-[52px]" loading={busy === "nickname"} disabledReason={nickname.trim() === (method.nickname ?? "") ? "Change the nickname first." : null}>
              Save
            </Button>
          </form>
          {error && (
            <p role="alert" className="rounded-input border border-danger px-4 py-3 text-label text-danger">
              {error}
            </p>
          )}
          <Button variant="danger-outline" onClick={() => run("delete")} loading={busy === "delete"}>
            Remove {method.type === "CARD" ? "card" : "wallet"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
