"use client";

import { CarFront, Clock3, CreditCard, CircleDollarSign, LogOut, Mail, Phone, Star, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { ModeToggle } from "@/components/app/ModeToggle";
import { Screen } from "@/components/app/Screen";
import { useSession } from "@/components/app/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { springSnappy } from "@/lib/motion";
import type { User } from "@/lib/types";

const digits = (s: string) => s.replace(/\D/g, "");

/** 7325550101 → 732-555-0101 (the format the seed data uses). Formats as you type. */
function formatPhone(raw: string): string {
  const d = digits(raw).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Profile (issue #45): who you are, how riders and drivers rate you, and the way out. */
export function ProfileScreen() {
  const { user, status, error, reload, signOut } = useSession();

  return (
    <Screen title="Profile">
      {status === "error" ? (
        <ErrorState message={error ?? "We couldn't load your account. Try again."} onRetry={reload} />
      ) : status !== "ready" || !user ? (
        <ProfileSkeleton />
      ) : (
        <div className="flex flex-col gap-8 pb-8">
          <Identity user={user} />
          <AccountForm key={user.id} user={user} />

          <section aria-labelledby="mode-title" className="flex flex-col gap-3">
            <h2 id="mode-title" className="eyebrow text-ink-muted">
              Mode
            </h2>
            <ModeToggle />
            <p className="text-label font-normal text-ink-muted">
              {user.isDriverApproved
                ? "Switch any time. Your rides and drives stay separate in Activity."
                : "Want to drive? Switching to Drive walks you through a 1-minute setup."}
            </p>
          </section>

          <section aria-labelledby="more-title" className="flex flex-col gap-1">
            <h2 id="more-title" className="eyebrow text-ink-muted">
              More
            </h2>
            <div className="-mx-3 flex flex-col">
              <ListRow href="/history" chevron leading={<Clock3 aria-hidden size={20} strokeWidth={2} />} title="Activity" subtitle="Past rides and receipts" />
              <ListRow href="/payment" chevron leading={<CreditCard aria-hidden size={20} strokeWidth={2} />} title="Payment" subtitle="Cards, wallets, UniHop Cash" />
              {user.isDriverApproved ? (
                <>
                  <ListRow href="/earnings" chevron leading={<CircleDollarSign aria-hidden size={20} strokeWidth={2} />} title="Earnings" subtitle="Balance and cash out" />
                  <ListRow href="/driver/onboard" chevron leading={<CarFront aria-hidden size={20} strokeWidth={2} />} title="Your car" subtitle="Driver profile" />
                </>
              ) : (
                <ListRow href="/driver/onboard" chevron leading={<CarFront aria-hidden size={20} strokeWidth={2} />} title="Become a driver" subtitle="Earn 90% of every base fare" />
              )}
            </div>
          </section>

          <Button
            variant="secondary"
            block
            leadingIcon={<LogOut aria-hidden size={20} strokeWidth={2} className="text-danger" />}
            onClick={() => {
              haptic("tick");
              signOut();
            }}
          >
            <span className="text-danger">Sign out</span>
          </Button>
        </div>
      )}
    </Screen>
  );
}

function Identity({ user }: { user: User }) {
  const rated = user.ratingCount > 0;
  return (
    <section aria-label="Your account" className="flex items-center gap-4">
      <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand font-display text-title text-on-brand">
        {initials(user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title text-ink">{user.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-label font-normal text-ink-muted">
          <Star aria-hidden size={14} strokeWidth={0} className="shrink-0 fill-accent" />
          {rated ? (
            <span>
              <span className="tnum font-semibold text-ink">{user.ratingAvg.toFixed(2)}</span>
              <span className="sr-only"> out of 5</span> · {user.ratingCount} {user.ratingCount === 1 ? "rating" : "ratings"}
            </span>
          ) : (
            <span>New to UniHop · no ratings yet</span>
          )}
        </p>
      </div>
    </section>
  );
}

function AccountForm({ user }: { user: User }) {
  const { setUser } = useSession();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [tries, setTries] = useState(0);
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== user.name || digits(phone) !== digits(user.phone ?? "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    else if (name.trim().length > 100) next.name = "Keep it under 100 characters.";
    // The API can't clear a phone once it's set, so an empty field isn't a valid edit.
    if (digits(phone).length !== 10 && (phone || user.phone)) next.phone = "Enter a 10-digit US number.";
    setErrors(next);
    setTries((n) => n + 1);
    if (next.name || next.phone) {
      haptic("error");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe({
        name: name.trim() !== user.name ? name.trim() : undefined,
        phone: digits(phone) !== digits(user.phone ?? "") ? formatPhone(phone) : undefined,
      });
      setUser(updated);
      setName(updated.name);
      setPhone(updated.phone ?? "");
      haptic("success");
      toast.show({ tone: "success", message: "Profile saved." });
    } catch (err) {
      haptic("error");
      if (err instanceof ApiRequestError && err.code === "VALIDATION_ERROR") {
        setErrors(/phone/i.test(err.message) ? { phone: "That number doesn't look right." } : { name: "That name doesn't look right." });
      } else {
        toast.show({ tone: "error", message: "Couldn't save your profile. Try again." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="account-title" className="flex flex-col gap-3">
      <h2 id="account-title" className="eyebrow text-ink-muted">
        Account
      </h2>
      <Card className="flex flex-col gap-4">
        <Input
          label="Name"
          autoComplete="name"
          value={name}
          maxLength={100}
          leading={<UserRound aria-hidden size={20} strokeWidth={2} />}
          error={errors.name}
          shakeKey={tries}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
          }}
        />
        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="732-555-0123"
          value={phone}
          leading={<Phone aria-hidden size={20} strokeWidth={2} />}
          hint="Your driver sees this only during a trip."
          error={errors.phone}
          shakeKey={tries}
          onChange={(e) => {
            setPhone(formatPhone(e.target.value));
            if (errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
          }}
        />
        <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
          <Mail aria-hidden size={20} strokeWidth={2} className="shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <p className="text-label font-normal text-ink-muted">Rutgers email</p>
            <p className="truncate text-body text-ink">{user.email}</p>
          </div>
        </div>
      </Card>
      <AnimatePresence initial={false}>
        {dirty && (
          <motion.div
            key="save"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
            transition={springSnappy}
            className="flex gap-3"
          >
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              disabled={saving}
              onClick={() => {
                setName(user.name);
                setPhone(user.phone ?? "");
                setErrors({});
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-[2]" loading={saving}>
              Save changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile" className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Skeleton rounded="full" className="size-16" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton rounded="full" className="h-11 w-full" />
    </div>
  );
}
