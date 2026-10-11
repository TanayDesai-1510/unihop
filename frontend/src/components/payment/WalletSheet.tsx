"use client";

import { Check, CreditCard } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/app/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { springHop } from "@/lib/motion";
import type { PaymentMethod, WalletType } from "@/lib/types";

const SHOW_ALL = process.env.NEXT_PUBLIC_DEMO_SHOW_ALL_WALLETS !== "false";

/** Which wallets this device should offer (DESIGN.md section 5: Apple Pay on iOS, Google Pay on Android). */
export function availableWallets(): WalletType[] {
  if (SHOW_ALL || typeof navigator === "undefined") return ["APPLE_PAY", "GOOGLE_PAY"];
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return ["APPLE_PAY"];
  if (/Android/i.test(ua)) return ["GOOGLE_PAY"];
  return [];
}

type Stage = "confirm" | "working" | "done" | "error";

/**
 * Mock Apple Pay / Google Pay sheets (issue #42). Text-only, no official logo artwork.
 * Apple style: black sheet, "Confirm with Side Button" for ~1.2s, then a check.
 * Google style: white sheet with an account row and a Continue button.
 * Both tokenize at /mockpay/v1/wallet-tokens and save the method.
 */
export function WalletSheet({ walletType, onClose, onAdded }: { walletType: WalletType | null; onClose: () => void; onAdded: (m: PaymentMethod) => void }) {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>("confirm");
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<WalletType | null>(null);
  const running = useRef(false);

  // New sheet: reset (adjusted during render).
  if (walletType && walletType !== opened) {
    setOpened(walletType);
    setStage("confirm");
    setError(null);
  }
  if (!walletType && opened) setOpened(null);

  const run = async () => {
    if (!walletType || running.current) return;
    running.current = true;
    setStage("working");
    setError(null);
    try {
      const minWait = new Promise((r) => setTimeout(r, reduce ? 300 : 1200));
      const token = await api.createWalletToken(walletType);
      const method = await api.addPaymentMethod({ token: token.token });
      await minWait;
      setStage("done");
      haptic("success");
      setTimeout(() => onAdded(method), 750);
    } catch (e) {
      haptic("error");
      setError(e instanceof ApiRequestError ? e.message : "Couldn't add the wallet. Try again.");
      setStage("error");
    } finally {
      running.current = false;
    }
  };

  // Apple style confirms itself after the side-button animation.
  useEffect(() => {
    if (walletType !== "APPLE_PAY" || stage !== "confirm") return;
    const t = setTimeout(run, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletType, stage]);

  const apple = walletType === "APPLE_PAY";

  return (
    <Sheet open={!!walletType} onClose={onClose} tone={apple ? "dark" : "default"}>
      {apple ? (
        <div className="flex flex-col gap-5 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-headline font-semibold">Apple&nbsp;Pay</span>
            <button type="button" onClick={onClose} className="h-11 px-2 text-label font-semibold opacity-80">
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-card bg-[var(--wallet-dark-ink)]/10 p-4">
            <span className="flex h-9 w-14 items-center justify-center rounded-[6px] bg-[var(--wallet-dark-ink)]/15">
              <CreditCard aria-hidden size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-body">Card in Wallet</p>
              <p className="text-label font-normal opacity-60">Add to UniHop</p>
            </div>
          </div>
          <p className="text-label font-normal opacity-60">UniHop will save a device token, never your card number.</p>
          <WalletStatus stage={stage} error={error} apple onRetry={run} />
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <p className="text-headline text-ink">
            <span className="font-semibold">Google Pay</span>
          </p>
          <div className="flex items-center gap-3 rounded-card bg-surface p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-label font-semibold text-on-brand">{(user?.name ?? "U").slice(0, 1)}</span>
            <div className="min-w-0">
              <p className="truncate text-body text-ink">{user?.name ?? "Your account"}</p>
              <p className="truncate text-label font-normal text-ink-muted">{user?.email ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-card border border-line p-4">
            <CreditCard aria-hidden size={20} strokeWidth={1.75} className="text-ink" />
            <p className="text-body text-ink">Card saved to Google Pay</p>
          </div>
          {stage === "confirm" ? (
            <Button variant="primary" onClick={run}>
              Continue
            </Button>
          ) : (
            <WalletStatus stage={stage} error={error} onRetry={run} />
          )}
        </div>
      )}
    </Sheet>
  );
}

function WalletStatus({ stage, error, apple, onRetry }: { stage: Stage; error: string | null; apple?: boolean; onRetry: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex min-h-[96px] flex-col items-center justify-center gap-3" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {stage === "done" ? (
          <motion.span key="done" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springHop} className="flex flex-col items-center gap-2">
            <span className={cn("flex size-14 items-center justify-center rounded-full", apple ? "bg-[var(--wallet-dark-ink)] text-[var(--wallet-dark)]" : "bg-success text-on-brand")}>
              <Check aria-hidden size={30} strokeWidth={3} />
            </span>
            <span className="text-label font-semibold">Done</span>
          </motion.span>
        ) : stage === "error" ? (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 text-center">
            <p role="alert" className="text-label text-danger">
              {error}
            </p>
            <button type="button" onClick={onRetry} className="h-11 text-label font-semibold underline">
              Try again
            </button>
          </motion.div>
        ) : (
          <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-full items-center justify-between">
            <span className="text-label font-semibold">{apple ? "Confirm with Side Button" : "Adding your card…"}</span>
            {apple && (
              /* The side-button hint: a pill pulsing at the device's right edge. */
              <motion.span
                aria-hidden
                className="h-14 w-1.5 rounded-full bg-[var(--wallet-dark-ink)]"
                animate={reduce ? { opacity: [0.4, 1, 0.4] } : { opacity: [0.35, 1, 0.35], x: [0, 4, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
