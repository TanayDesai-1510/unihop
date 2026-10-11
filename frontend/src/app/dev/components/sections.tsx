"use client";

import { MapPin, MessageCircle, Phone, Share2, ShieldCheck } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, type Transition } from "motion/react";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/brand/AnimatedNumber";
import { GlassSheet } from "@/components/brand/GlassSheet";
import { HopDots, HopIn } from "@/components/brand/Hop";
import { Price } from "@/components/brand/Price";
import { HeroSurface, LaneDivider, LicensePlate, TicketCard } from "@/components/brand/Road";
import { RoadScene } from "@/components/brand/RoadScene";
import { RoadTimeline } from "@/components/brand/RoadTimeline";
import { DriverRow, PinBoxes, RoundAction, RouteSummary } from "@/components/rider/parts";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { springHop, springSmooth, springSnappy } from "@/lib/motion";
import type { DriverCard, Hub } from "@/lib/types";

const BrandMapPreview = dynamic(() => import("@/components/brand/BrandMapPreview"), {
  ssr: false,
  loading: () => <Skeleton rounded="card" className="h-full w-full" />,
});

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="eyebrow text-ink-muted">{title}</h2>
        {note && <p className="mt-1 text-label font-normal text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const YARD: Hub = { id: "y", code: "YARD", name: "The Yard", zone: "COLLEGE_AVE", lat: 40.4998, lng: -74.4479 };
const COOK: Hub = { id: "c", code: "COOK_CC", name: "Cook Campus Center", zone: "COOK_DOUGLASS", lat: 40.4797, lng: -74.4362 };
const ALEX: DriverCard = { id: "d", name: "Alex Kim", ratingAvg: 4.92, carMake: "Honda", carModel: "Civic", carColor: "Blue", plate: "R23-HKP", lat: null, lng: null };

export function TypeSpecimen() {
  return (
    <Section title="Typography" note="Bricolage Grotesque (display), Instrument Sans (text), Geist Mono (plates, PIN, card numbers).">
      <div className="flex flex-col gap-3">
        <p className="text-hero text-ink">
          Every ride under <span className="text-accent">$10</span>.
        </p>
        <Price amount={6.5} size="hero" className="text-ink" />
        <p className="text-display text-ink">Arriving at 4:12</p>
        <p className="text-title text-ink">Where to?</p>
        <p className="text-headline text-ink">Alex Kim · Blue Honda Civic</p>
        <p className="text-body text-ink">Your driver is two minutes away. Meet at the curb by the bus stop.</p>
        <p className="text-label text-ink-muted">Pickup · The Yard</p>
        <p className="eyebrow text-ink-muted">Ride complete</p>
        <p className="font-mono-num text-[22px] text-ink">4242 4242 4242 4242</p>
      </div>
    </Section>
  );
}

export function NumbersDemo() {
  const fares = [4.5, 5.5, 6.5, 8.5];
  const [i, setI] = useState(2);
  const [eta, setEta] = useState(7);
  return (
    <Section title="Animated numbers" note="Fares and ETAs tick to new values; earnings count up.">
      <div className="flex items-end justify-between rounded-card bg-surface p-4">
        <div>
          <p className="text-label font-normal text-ink-muted">Fare</p>
          <Price amount={fares[i]} size="display" className="text-ink" />
        </div>
        <div className="text-right">
          <p className="text-label font-normal text-ink-muted">ETA</p>
          <p className="text-display text-ink">
            <AnimatedNumber value={eta} /> <span className="text-title">min</span>
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="md" onClick={() => setI((n) => (n + 1) % fares.length)}>
          Next fare
        </Button>
        <Button variant="secondary" size="md" onClick={() => setEta((n) => (n <= 1 ? 9 : n - 2))}>
          Tick ETA
        </Button>
      </div>
      <div className="rounded-card bg-surface p-4">
        <p className="text-label font-normal text-ink-muted">Earnings this week (counts up)</p>
        <Price key={i} amount={127.4} size="hero" countUp className="text-ink" />
      </div>
    </Section>
  );
}

export function RoadKit() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const steps = [
    { key: "a", label: "Accepted" },
    { key: "b", label: "Arrived" },
    { key: "c", label: "On trip" },
    { key: "d", label: "Dropped off" },
  ];
  return (
    <Section title="Road motif" note="Lane lines, the ticket, the plate, and the road timeline.">
      <RoadTimeline steps={steps} current={step} progress={progress} />
      <div className="flex gap-3">
        <Button variant="secondary" size="md" onClick={() => setProgress((p) => (p >= 0.75 ? 0 : p + 0.25))}>
          Creep forward
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            setStep((s) => (s + 1) % steps.length);
            setProgress(0);
          }}
        >
          Next status
        </Button>
      </div>
      <LaneDivider label="Lane divider" />
      <TicketCard
        top={<RouteSummary pickup={YARD} dropoff={COOK} />}
        bottom={
          <div className="flex items-end justify-between">
            <div>
              <p className="text-label font-normal text-ink-muted">UniHop Cash + Visa •••• 4242</p>
              <p className="text-caption text-ink-muted">Under $10, always</p>
            </div>
            <Price amount={6.5} size="display" className="text-ink" />
          </div>
        }
      />
      <div className="flex items-center gap-4">
        <LicensePlate plate="R23-HKP" />
        <LicensePlate plate="K56-BNX" size="sm" />
      </div>
      <PinBoxes pin="3020" />
    </Section>
  );
}

export function HeroDemo() {
  return (
    <Section title="Hero surface" note="Login, splash, offer and receipt tops: logo navy with a soft orange glow.">
      <HeroSurface className="rounded-card px-5 py-6">
        <p className="eyebrow text-on-brand/70">You earn</p>
        <Price amount={4.5} size="hero" />
        <p className="mt-2 text-label font-normal text-on-brand/75">Pickup 0.4 mi away · The Yard to Cook</p>
      </HeroSurface>
    </Section>
  );
}

export function HopDemo() {
  const [enabled, setEnabled] = useState(false);
  return (
    <Section title="The hop" note="The accent CTA hops once when it becomes enabled; loading uses hopping dots.">
      <HopIn trigger={enabled}>
        <Button variant="accent" disabledReason={enabled ? null : "Pick a drop-off first."}>
          Request UniHop
        </Button>
      </HopIn>
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="md" block={false} onClick={() => setEnabled((e) => !e)}>
          {enabled ? "Disable" : "Enable"} CTA
        </Button>
        <HopDots />
        <HopDots tone="accent" />
      </div>
    </Section>
  );
}

export function ScenesDemo() {
  return (
    <Section title="Empty-state illustrations" note="Built from the road motif in SVG with tokens.">
      <div className="grid grid-cols-2 gap-3">
        {(["pin", "ticket", "coins", "search"] as const).map((v) => (
          <div key={v} className="flex flex-col items-center gap-2 rounded-card bg-surface py-4">
            <RoadScene variant={v} className="h-20" />
            <span className="text-caption text-ink-muted">{v}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

const SPRINGS: Array<{ name: string; t: Transition; note: string }> = [
  { name: "snappy", t: springSnappy, note: "500 / 35 · presses, toggles" },
  { name: "smooth", t: springSmooth, note: "260 / 30 · sheets, cards" },
  { name: "hop", t: springHop, note: "600 / 14 · the bounce" },
];

export function SpringsDemo() {
  const [on, setOn] = useState(false);
  return (
    <Section title="Springs" note="Tap to send all three; tap again mid-flight to reverse (interruptible).">
      <button type="button" onClick={() => setOn((v) => !v)} className="flex flex-col gap-3 rounded-card bg-surface p-4 text-left">
        {SPRINGS.map((s) => (
          <div key={s.name}>
            <div className="mb-1 flex justify-between text-label">
              <span className="text-ink">{s.name}</span>
              <span className="font-normal text-ink-muted">{s.note}</span>
            </div>
            <div className="relative h-9 rounded-full bg-surface-raised">
              <motion.span
                className="absolute left-1 top-1 size-7 rounded-full bg-brand"
                animate={{ x: on ? 262 : 0 }}
                transition={s.t}
                style={{ maxWidth: "calc(100% - 8px)" }}
              />
            </div>
          </div>
        ))}
        <span className="text-label font-semibold text-brand">{on ? "Tap to send back" : "Tap to send"}</span>
      </button>
    </Section>
  );
}

export function SheetDemo() {
  const [snap, setSnap] = useState(1);
  return (
    <Section title="Glass sheet detents" note={`Peek, half, full. Flick it, grab it mid-flight. Map dims only at full. Now: ${["peek", "half", "full"][snap]}.`}>
      <div className="relative h-[600px] overflow-hidden rounded-card border border-line">
        <BrandMapPreview />
        <GlassSheet aria-label="Detents demo" snapPoints={[150, "52%", "100%"]} defaultSnap={1} onSnapChange={setSnap} className="z-[700]" header={<h3 className="text-title text-ink">Where to?</h3>}>
          <div className="-mx-3 flex flex-col">
            {["The Yard", "Busch Student Center", "Livingston Student Center", "Cook Campus Center", "Douglass Student Center", "New Brunswick Station"].map((h) => (
              <ListRow key={h} leading={<MapPin aria-hidden size={20} strokeWidth={2} />} title={h} subtitle="Campus hub" chevron onClick={() => {}} />
            ))}
          </div>
        </GlassSheet>
      </div>
    </Section>
  );
}

export function SharedDemo() {
  const [active, setActive] = useState(false);
  return (
    <Section title="Shared element transition" note="The driver card morphs from the offer to the active ride (layoutId).">
      <LayoutGroup id="shared-demo">
        <div className="relative min-h-[300px] overflow-hidden rounded-card bg-surface p-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {!active ? (
              <motion.div key="offer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={springSmooth} className="overflow-hidden rounded-card">
                <HeroSurface className="px-4 pb-4 pt-4">
                  <p className="eyebrow text-on-brand/70">New trip · 15s</p>
                  <p className="text-headline">You earn</p>
                  <Price amount={4.5} size="display" />
                </HeroSurface>
                <div className="flex flex-col gap-3 bg-surface-raised p-4">
                  <DriverRow driver={ALEX} layoutId="demo-driver" />
                  <Button variant="accent" onClick={() => setActive(true)}>
                    Accept
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={springSmooth} className="flex flex-col gap-4 rounded-card bg-surface-raised p-4">
                <p className="text-title text-ink">Meet at The Yard · 3 min</p>
                <DriverRow driver={ALEX} layoutId="demo-driver" />
                <div className="flex">
                  <RoundAction icon={<MessageCircle aria-hidden size={22} strokeWidth={2} />} label="Message" />
                  <RoundAction icon={<Phone aria-hidden size={22} strokeWidth={2} />} label="Call" />
                  <RoundAction icon={<Share2 aria-hidden size={22} strokeWidth={2} />} label="Share" />
                  <RoundAction icon={<ShieldCheck aria-hidden size={22} strokeWidth={2} />} label="Safety" tone="safety" />
                </div>
                <Button variant="secondary" onClick={() => setActive(false)}>
                  Back to offer
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </Section>
  );
}
