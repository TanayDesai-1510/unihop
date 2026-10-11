"use client";

import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { homeFor } from "@/components/app/SessionProvider";
import { Logo } from "@/components/brand/Logo";
import { HeroSurface } from "@/components/brand/Road";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OtpInput } from "@/components/ui/OtpInput";
import { api, ApiRequestError, setToken } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { fadeUI, pressable, springSmooth, stateSwap } from "@/lib/motion";

const DOMAIN = "@scarletmail.rutgers.edu";

/** Login: navy hero with the value prop, then scarletmail + 6-box code (DESIGN.md section 8). */
export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<"email" | "code">("email");
  const [netid, setNetid] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const verifying = useRef(false);

  const email = (netid.includes("@") ? netid : `${netid}${DOMAIN}`).trim().toLowerCase();

  const sendCode = async () => {
    if (!netid.trim()) {
      setError("Enter your NetID to get a code.");
      setTries((n) => n + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestOtp(email);
      setDevOtp(res.devOtp);
      setCode("");
      setStep("code");
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.code === "INVALID_EMAIL_DOMAIN" ? "Use your Rutgers scarletmail address." : e.message) : "Couldn't send a code. Try again.");
      setTries((n) => n + 1);
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (otp: string) => {
    if (verifying.current) return;
    verifying.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyOtp({ email, otp });
      setToken(res.token);
      haptic("success");
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(res.user.mode));
    } catch (e) {
      setError(e instanceof ApiRequestError && e.code === "INVALID_OTP" ? "That code isn't right. Check it and try again." : "Couldn't sign you in. Try again.");
      setTries((n) => n + 1);
      setCode("");
      haptic("error");
      setBusy(false);
    } finally {
      verifying.current = false;
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-bg">
      <HeroSurface className="px-6 pb-14 pt-[calc(env(safe-area-inset-top)+28px)]">
        <div className="flex items-center gap-2.5">
          <Logo variant="mark" onBrand size={40} priority />
          <Wordmark size="sm" onBrand />
        </div>
        <motion.h1
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSmooth, delay: 0.05 }}
          className="mt-14 text-hero"
        >
          Every ride
          <br />
          under <span className="text-accent">$10</span>.
        </motion.h1>
        <p className="mt-4 max-w-[300px] text-body text-on-brand/75">Students only. Campus hub to hub, a driver from your school.</p>
      </HeroSurface>

      <div className="relative -mt-6 flex flex-1 flex-col rounded-t-sheet bg-bg px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-7">
        <AnimatePresence mode="popLayout" initial={false}>
          {step === "email" ? (
            <motion.form
              key="email"
              initial={reduce ? { opacity: 0 } : stateSwap.initial}
              animate={stateSwap.animate}
              exit={reduce ? { opacity: 0 } : stateSwap.exit}
              transition={reduce ? fadeUI : springSmooth}
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
              className="flex flex-col gap-5"
            >
              <div>
                <h2 className="text-title text-ink">Sign in</h2>
                <p className="mt-1 text-label font-normal text-ink-muted">We&apos;ll send a code to your scarletmail.</p>
              </div>
              <Input
                label="NetID"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="netid"
                value={netid}
                onChange={(e) => {
                  setNetid(e.target.value.replace(DOMAIN, ""));
                  setError(null);
                }}
                leading={<Mail aria-hidden size={20} strokeWidth={2} />}
                trailing={!netid.includes("@") && <span className="text-label font-normal text-ink-muted">{DOMAIN}</span>}
                error={error}
                shakeKey={tries}
              />
              <Button type="submit" variant="primary" loading={busy}>
                Send code
              </Button>
              <p className="text-center text-caption font-medium text-ink-muted">Rutgers students only. By continuing you agree to ride respectfully.</p>
            </motion.form>
          ) : (
            <motion.div
              key="code"
              initial={reduce ? { opacity: 0 } : stateSwap.initial}
              animate={stateSwap.animate}
              exit={reduce ? { opacity: 0 } : stateSwap.exit}
              transition={reduce ? fadeUI : springSmooth}
              className="flex flex-col gap-5"
            >
              <div className="flex items-start gap-1">
                <motion.button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setError(null);
                  }}
                  {...pressable}
                  aria-label="Change email"
                  className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink"
                >
                  <ArrowLeft aria-hidden size={22} strokeWidth={2} />
                </motion.button>
                <div className="min-w-0 pt-1.5">
                  <h2 className="text-title text-ink">Enter your code</h2>
                  <p className="mt-1 truncate text-label font-normal text-ink-muted">Sent to {email}</p>
                </div>
              </div>
              <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={verify} error={!!error} shakeKey={tries} disabled={busy} aria-label="6-digit sign-in code" />
              <AnimatePresence initial={false}>
                {error && (
                  <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="-mt-2 text-label text-danger">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              {devOtp && (
                <div className="flex items-center gap-3 rounded-card bg-brand-soft px-4 py-3">
                  <KeyRound aria-hidden size={20} strokeWidth={2} className="shrink-0 text-brand" />
                  <p className="text-label font-normal text-ink">
                    Demo code: <span className="font-mono-num text-ink">{devOtp}</span>
                  </p>
                  <button type="button" onClick={() => { setCode(devOtp); verify(devOtp); }} className="ml-auto text-label font-semibold text-brand">
                    Use it
                  </button>
                </div>
              )}
              <Button variant="primary" loading={busy} onClick={() => verify(code)} disabledReason={code.length === 6 ? null : "Enter all 6 digits."}>
                Verify and continue
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
