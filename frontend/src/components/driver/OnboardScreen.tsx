"use client";

import { ArrowLeft, BadgeCheck, Car, IdCard } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/app/SessionProvider";
import { HopIn } from "@/components/brand/Hop";
import { HeroSurface, LicensePlate } from "@/components/brand/Road";
import { CarAvatar, paintFor } from "@/components/rider/parts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { pressable, springSmooth } from "@/lib/motion";
import type { DriverProfile } from "@/lib/types";

const COLORS = ["Black", "White", "Silver", "Gray", "Blue", "Red", "Green"];

type Field = "licenseNumber" | "carMake" | "carModel" | "carColor" | "plate";

function validate(v: Record<Field, string>): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  if (v.licenseNumber.replace(/\s/g, "").length < 5) e.licenseNumber = "Enter the number on your driver's license.";
  if (!v.carMake.trim()) e.carMake = "Enter the make, like Honda.";
  if (!v.carModel.trim()) e.carModel = "Enter the model, like Civic.";
  if (!v.carColor.trim()) e.carColor = "Pick your car's color.";
  if (!/^[A-Z0-9-]{2,8}$/.test(v.plate.trim())) e.plate = "Plates are 2 to 8 letters, numbers or dashes.";
  return e;
}

/** Become a driver (issue #36): live car + plate preview, then onboard and switch to driver mode. */
export function OnboardScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, status, setMode, setUser } = useSession();
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [values, setValues] = useState<Record<Field, string>>({ licenseNumber: "", carMake: "", carModel: "", carColor: "", plate: "" });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState(false);

  // Already onboarded? Show the "all set" state instead of the form.
  const approved = status === "ready" && !!user?.isDriverApproved;
  useEffect(() => {
    if (!approved) return;
    api
      .getMyDriverProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [approved]);
  // undefined = loading, null = show the form. While submitting, keep showing the form.
  const existing = status !== "ready" ? undefined : !approved || busy ? null : profile;

  const errors = useMemo(() => validate(values), [values]);
  const valid = Object.keys(errors).length === 0;
  const show = (f: Field) => (touched ? errors[f] : null);
  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setValues((v) => ({ ...v, [f]: f === "plate" || f === "licenseNumber" ? raw.toUpperCase() : raw }));
    setServerError(null);
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || busy) {
      if (!valid) haptic("error");
      return;
    }
    setBusy(true);
    try {
      await api.onboardDriver({
        licenseNumber: values.licenseNumber.trim(),
        carMake: values.carMake.trim(),
        carModel: values.carModel.trim(),
        carColor: values.carColor.trim(),
        plate: values.plate.trim(),
      });
      if (user) setUser({ ...user, isDriverApproved: true });
      await setMode("DRIVER");
      haptic("success");
      toast.show({ tone: "success", message: "You're approved. Go online whenever you're ready." });
      router.push("/driver");
    } catch (e) {
      setServerError(e instanceof ApiRequestError ? e.message : "Couldn't save your details. Try again.");
      haptic("error");
      setBusy(false);
    }
  };

  const plate = values.plate.trim() || "UNI-HOP";
  const color = values.carColor || "Gray";

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-bg">
      <HeroSurface className="px-5 pb-16 pt-[calc(env(safe-area-inset-top)+12px)]">
        <motion.div {...pressable} className="-ml-2 inline-flex">
          <Link href="/rider" aria-label="Back to rider home" className="flex size-11 items-center justify-center rounded-full text-on-brand">
            <ArrowLeft aria-hidden size={22} strokeWidth={2} />
          </Link>
        </motion.div>
        <p className="eyebrow mt-3 text-on-brand/70">Drive with UniHop</p>
        <h1 className="mt-1 text-display">
          Earn <span className="text-accent">90%</span> of every base fare.
        </h1>
        <p className="mt-2 max-w-[300px] text-label font-normal text-on-brand/75">Drive classmates between campus hubs, on your own schedule. Approval is instant for the demo.</p>
      </HeroSurface>

      <div className="relative -mt-10 px-5 pb-10">
        {/* Live preview: your car, tinted to its color, with your plate. */}
        <div className="flex items-center gap-4 rounded-card border border-elevated-border bg-surface-raised p-4 shadow-[var(--shadow-float)]">
          <CarAvatar name={user?.name ?? "You"} carColor={color} className="scale-110" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-headline text-ink">{[values.carColor, values.carMake, values.carModel].filter(Boolean).join(" ") || "Your car"}</p>
            <p className="text-label font-normal text-ink-muted">Riders see this</p>
          </div>
          <LicensePlate plate={plate} size="sm" />
        </div>

        {existing === undefined ? (
          <div className="mt-6 flex flex-col gap-4">
            <Skeleton className="h-[52px] w-full" rounded="card" />
            <Skeleton className="h-[52px] w-full" rounded="card" />
            <Skeleton className="h-[52px] w-full" rounded="card" />
          </div>
        ) : existing ? (
          <AllSet profile={existing} onDrive={async () => {
            await setMode("DRIVER").catch(() => {});
            router.push("/driver");
          }} />
        ) : (
          <form
            className="mt-6 flex flex-col gap-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input label="Driver's license number" autoCapitalize="characters" autoComplete="off" value={values.licenseNumber} onChange={set("licenseNumber")} error={show("licenseNumber")} leading={<IdCard aria-hidden size={20} strokeWidth={2} />} placeholder="K1234 56789 01234" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Make" value={values.carMake} onChange={set("carMake")} error={show("carMake")} placeholder="Honda" autoComplete="off" />
              <Input label="Model" value={values.carModel} onChange={set("carModel")} error={show("carModel")} placeholder="Civic" autoComplete="off" />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-label text-ink">Color</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => {
                  const on = !customColor && values.carColor === c;
                  return (
                    <motion.button
                      key={c}
                      type="button"
                      {...pressable}
                      aria-pressed={on}
                      onClick={() => {
                        setCustomColor(false);
                        setValues((v) => ({ ...v, carColor: c }));
                        haptic("tick");
                      }}
                      className={cn("flex h-11 items-center gap-2 rounded-full border px-3.5 text-label font-semibold", on ? "border-brand bg-brand-soft text-ink ring-1 ring-brand ring-inset" : "border-line bg-surface-raised text-ink")}
                    >
                      <span aria-hidden className="size-4 rounded-full border border-line" style={{ background: paintFor(c) }} />
                      {c}
                    </motion.button>
                  );
                })}
                <motion.button
                  type="button"
                  {...pressable}
                  aria-pressed={customColor}
                  onClick={() => {
                    setCustomColor(true);
                    setValues((v) => ({ ...v, carColor: "" }));
                  }}
                  className={cn("flex h-11 items-center rounded-full border px-3.5 text-label font-semibold", customColor ? "border-brand bg-brand-soft text-ink ring-1 ring-brand ring-inset" : "border-line bg-surface-raised text-ink")}
                >
                  Other
                </motion.button>
              </div>
              <AnimatePresence initial={false}>
                {customColor && (
                  <motion.div key="custom" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={springSmooth}>
                    <Input label="Color" hideLabel autoFocus value={values.carColor} onChange={set("carColor")} placeholder="e.g. Maroon" />
                  </motion.div>
                )}
              </AnimatePresence>
              {show("carColor") && <p className="text-label text-danger">{show("carColor")}</p>}
            </fieldset>

            <Input label="License plate" autoCapitalize="characters" autoComplete="off" value={values.plate} onChange={set("plate")} error={show("plate")} leading={<Car aria-hidden size={20} strokeWidth={2} />} placeholder="R23-HKP" className="[&_input]:font-mono-num" maxLength={8} />

            {serverError && (
              <p role="alert" className="rounded-input border border-danger px-4 py-3 text-label text-danger">
                {serverError}
              </p>
            )}

            <HopIn trigger={valid}>
              <Button type="submit" variant="primary" loading={busy}>
                Start driving
              </Button>
            </HopIn>
            <p className="text-center text-caption font-medium text-ink-muted">You can switch back to riding anytime from the top of the map.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function AllSet({ profile, onDrive }: { profile: DriverProfile; onDrive: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-card bg-surface p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-success text-on-brand">
        <BadgeCheck aria-hidden size={26} strokeWidth={2} />
      </span>
      <h2 className="text-title text-ink">You&apos;re all set</h2>
      <p className="text-label font-normal text-ink-muted">
        {profile.carColor} {profile.carMake} {profile.carModel} · <span className="font-mono-num">{profile.plate}</span>
      </p>
      <Button variant="primary" className="mt-2" onClick={onDrive}>
        Go to driver home
      </Button>
    </div>
  );
}
