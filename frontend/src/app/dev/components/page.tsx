"use client";

import { ArrowRight, Banknote, CircleDot, Clock3, MapPin, Monitor, Moon, Play, Plus, Search, Sun, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Screen } from "@/components/app/Screen";
import { Logo } from "@/components/brand/Logo";
import { SplashOverlay } from "@/components/brand/Splash";
import { LogoLockup, Wordmark } from "@/components/brand/Wordmark";
import { HeroDemo, HopDemo, NumbersDemo, RoadKit, ScenesDemo, SharedDemo, SheetDemo, SpringsDemo, TypeSpecimen } from "./sections";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListRow,
  PaymentBadge,
  RideStatusPill,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  SkeletonListRow,
  StatusPill,
  Switch,
  useToast,
} from "@/components/ui";
import { API_URL, checkHealth, USE_MOCKS } from "@/lib/api";
import { RIDE_STATUSES } from "@/lib/types";

// Leaflet needs window: client-only.
const BrandMapPreview = dynamic(() => import("@/components/brand/BrandMapPreview"), {
  ssr: false,
  loading: () => <Skeleton rounded="card" className="h-full w-full" />,
});

/** Every component and variant in one place for design review. Not linked from the app. */
export default function ComponentsPage() {
  return (
    <Screen title="Components" subtitle="UniHop design system, DESIGN.md" action={<ThemeSwitch />}>
      <div className="flex flex-col gap-10">
        <BackendStatus />
        <Brand />
        <TypeSpecimen />
        <NumbersDemo />
        <RoadKit />
        <HeroDemo />
        <HopDemo />
        <ScenesDemo />
        <SpringsDemo />
        <SharedDemo />
        <SheetDemo />
        <MapStyle />
        <Tokens />
        <Buttons />
        <Inputs />
        <Cards />
        <Rows />
        <Pills />
        <Badges />
        <Controls />
        <Toasts />
        <Skeletons />
        <States />
      </div>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-caption uppercase tracking-[0.08em] text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function BackendStatus() {
  const [status, setStatus] = useState<"checking" | "up" | "down">("checking");
  useEffect(() => {
    checkHealth()
      .then(() => setStatus("up"))
      .catch(() => setStatus("down"));
  }, []);
  return (
    <Section title="Environment">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <LogoLockup size={28} />
          <StatusPill
            tone={status === "up" ? "success" : status === "down" ? "muted" : "pending"}
            label={status === "up" ? "Backend online" : status === "down" ? "Backend offline" : "Checking"}
          />
        </div>
        <p className="break-all text-label font-normal text-ink-muted">
          {API_URL} · data from {USE_MOCKS ? "mocks" : "real API"}
        </p>
      </Card>
    </Section>
  );
}

const TOKENS = ["brand", "brand-strong", "brand-soft", "accent", "accent-soft", "bg", "surface", "surface-raised", "ink", "ink-muted", "line", "success", "warning", "danger"];

function Tokens() {
  return (
    <Section title="Color tokens">
      <div className="grid grid-cols-3 gap-3">
        {TOKENS.map((t) => (
          <div key={t} className="flex flex-col gap-2">
            <span className="h-12 rounded-chip border border-line" style={{ background: `var(--${t})` }} />
            <span className="text-caption text-ink-muted">--{t}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Buttons() {
  const [loading, setLoading] = useState(false);
  return (
    <Section title="Button">
      <div className="flex flex-col gap-3">
        <Button variant="accent">Request UniHop</Button>
        <Button variant="primary" trailingIcon={<ArrowRight aria-hidden size={20} strokeWidth={2} />}>
          Continue
        </Button>
        <Button variant="secondary" leadingIcon={<Plus aria-hidden size={20} strokeWidth={2} />}>
          Add payment method
        </Button>
        <Button variant="ghost">Not now</Button>
        <Button variant="danger-outline">Cancel ride</Button>
        <Button
          variant="primary"
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        >
          Tap to load
        </Button>
        <Button variant="primary" disabledReason="Pick a dropoff first.">
          Disabled with reason (tap me)
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <div className="flex gap-3">
          <Button size="md" variant="secondary">
            Medium
          </Button>
          <Button size="md" variant="primary">
            Medium
          </Button>
        </div>
      </div>
    </Section>
  );
}

function Inputs() {
  const [email, setEmail] = useState("");
  const [tries, setTries] = useState(0);
  const error = tries > 0 ? "Your card was declined. Try another payment method." : null;
  return (
    <Section title="Input">
      <div className="flex flex-col gap-5">
        <Input label="Scarletmail" type="email" inputMode="email" placeholder="netid@scarletmail.rutgers.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Search" hideLabel placeholder="Search hubs" leading={<Search aria-hidden size={20} strokeWidth={2} />} />
        <Input label="Card number" inputMode="numeric" defaultValue="4000 0000 0000 0002" trailing={<PaymentBadge brand="VISA" />} error={error} shakeKey={tries} />
        <Button variant="secondary" size="md" onClick={() => setTries((n) => n + 1)}>
          Simulate decline (shake)
        </Button>
        <Input label="Nickname" hint="Optional. Shows in your payment list." placeholder="Debit card" />
      </div>
    </Section>
  );
}

function Cards() {
  return (
    <Section title="Card">
      <Card>
        <p className="text-label text-ink-muted">Your fare</p>
        <p className="tnum text-display">$6.50</p>
        <p className="text-caption text-ink-muted">Under $10, always</p>
      </Card>
      <Card elevation="flat">
        <p className="text-body">Flat card sits inside another surface.</p>
      </Card>
    </Section>
  );
}

function Rows() {
  const [selected, setSelected] = useState("pickup");
  return (
    <Section title="ListRow">
      <Card padded={false} className="p-2">
        <ListRow
          leading={<CircleDot aria-hidden size={20} strokeWidth={2} />}
          title="The Yard"
          subtitle="College Ave"
          selected={selected === "pickup"}
          onClick={() => setSelected("pickup")}
        />
        <ListRow
          leading={<MapPin aria-hidden size={20} strokeWidth={2} />}
          title="Cook Campus Center"
          subtitle="Cook/Douglass"
          selected={selected === "dropoff"}
          onClick={() => setSelected("dropoff")}
        />
        <ListRow leading={<PaymentBadge brand="VISA" />} title="Visa •••• 4242" subtitle="Default" chevron onClick={() => {}} />
        <ListRow leading={<PaymentBadge brand="VISA" type="APPLE_PAY" />} title="Apple Pay" chevron onClick={() => {}} />
        <ListRow leading={<Wallet aria-hidden size={20} strokeWidth={2} />} title="UniHop Cash" subtitle="Applied first" trailing={<span className="tnum font-semibold">$5.00</span>} />
        <ListRow leading={<Clock3 aria-hidden size={20} strokeWidth={2} />} title="Busch to Livingston" subtitle="Oct 11, 9:41 AM" trailing={<span className="tnum">$5.50</span>} disabled />
      </Card>
    </Section>
  );
}

function Pills() {
  return (
    <Section title="StatusPill">
      <div className="flex flex-wrap gap-2">
        {RIDE_STATUSES.map((s) => (
          <RideStatusPill key={s} status={s} />
        ))}
        <StatusPill tone="danger" label="Payment failed" />
        <StatusPill tone="success" label="You're online" />
      </div>
    </Section>
  );
}

function Badges() {
  return (
    <Section title="Badge">
      <div className="flex flex-wrap gap-2">
        <PaymentBadge brand="VISA" />
        <PaymentBadge brand="MASTERCARD" />
        <PaymentBadge brand="AMEX" />
        <PaymentBadge brand="DISCOVER" />
        <PaymentBadge brand="VISA" type="APPLE_PAY" />
        <PaymentBadge brand="VISA" type="GOOGLE_PAY" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge tone="brand">Selected</Badge>
        <Badge tone="accent">Live</Badge>
        <Badge tone="success">Paid</Badge>
        <Badge tone="warning">Expiring</Badge>
        <Badge tone="danger">Declined</Badge>
        <Badge tone="inverse">New</Badge>
      </div>
    </Section>
  );
}

function Controls() {
  const [mode, setMode] = useState<"RIDER" | "DRIVER">("RIDER");
  const [cash, setCash] = useState(true);
  const [online, setOnline] = useState(false);
  return (
    <Section title="SegmentedControl and Switch">
      <SegmentedControl
        aria-label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "RIDER", label: "Ride" },
          { value: "DRIVER", label: "Drive" },
        ]}
      />
      <Card padded={false} className="p-2">
        <ListRow
          leading={<Banknote aria-hidden size={20} strokeWidth={2} />}
          title="Use UniHop Cash"
          subtitle="$5.00 available"
          trailing={<Switch aria-label="Use UniHop Cash" checked={cash} onChange={setCash} />}
        />
        <ListRow title={online ? "You're online" : "You're offline"} trailing={<Switch aria-label="Online" checked={online} onChange={setOnline} tone="success" />} />
      </Card>
    </Section>
  );
}

function Toasts() {
  const toast = useToast();
  return (
    <Section title="Toast">
      <div className="flex flex-col gap-3">
        <Button variant="secondary" size="md" onClick={() => toast.show({ tone: "success", message: "Card saved. Visa •••• 4242 is ready to use." })}>
          Success toast
        </Button>
        <Button variant="secondary" size="md" onClick={() => toast.show({ tone: "error", message: "Your card was declined. Try another payment method." })}>
          Error toast
        </Button>
        <Button variant="secondary" size="md" onClick={() => toast.show({ tone: "info", message: "Set up your driver profile to start driving." })}>
          Info toast
        </Button>
      </div>
    </Section>
  );
}

function Skeletons() {
  return (
    <Section title="Skeleton">
      <SkeletonGroup>
        <Card padded={false} className="p-2">
          <SkeletonListRow />
          <SkeletonListRow />
        </Card>
        <Card className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-4 w-28" />
        </Card>
      </SkeletonGroup>
    </Section>
  );
}

function States() {
  return (
    <Section title="Empty and error states">
      <Card>
        <EmptyState
          icon={<Clock3 aria-hidden size={24} strokeWidth={2} />}
          title="No rides yet"
          message="Your trips will show up here after your first ride."
          action={{ label: "Book a ride", onClick: () => {} }}
        />
      </Card>
      <Card>
        <ErrorState message="We couldn't load your rides. Check your connection and try again." onRetry={() => {}} />
      </Card>
    </Section>
  );
}

type Theme = "system" | "light" | "dark";

/** Forces light or dark for this page only (sets data-theme on <html>; cleared on leave). */
function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    window.dispatchEvent(new Event("unihop:theme"));
  }, [theme]);
  useEffect(() => () => void delete document.documentElement.dataset.theme, []);
  return (
    <SegmentedControl<Theme>
      aria-label="Theme"
      className="w-[132px] shrink-0"
      value={theme}
      onChange={setTheme}
      options={[
        { value: "system", label: "", ariaLabel: "System theme", icon: <Monitor aria-hidden size={20} strokeWidth={2} /> },
        { value: "light", label: "", ariaLabel: "Light theme", icon: <Sun aria-hidden size={20} strokeWidth={2} /> },
        { value: "dark", label: "", ariaLabel: "Dark theme", icon: <Moon aria-hidden size={20} strokeWidth={2} /> },
      ]}
    />
  );
}

function Brand() {
  const [splashKey, setSplashKey] = useState(0);
  const [showSplash, setShowSplash] = useState(false);
  const replay = () => {
    setSplashKey((k) => k + 1);
    setShowSplash(true);
    setTimeout(() => setShowSplash(false), 620);
  };
  return (
    <Section title="Brand">
      <Card className="flex flex-col gap-5">
        <div className="flex items-end gap-5">
          <figure className="flex flex-col items-center gap-2">
            <Logo variant="icon" size={64} />
            <figcaption className="text-caption text-ink-muted">icon</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-2">
            <Logo variant="mark" size={64} />
            <figcaption className="text-caption text-ink-muted">mark (auto)</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-2">
            <span className="flex size-16 items-center justify-center rounded-card bg-brand-logo">
              <Logo variant="mark" onBrand size={48} />
            </span>
            <figcaption className="text-caption text-ink-muted">mark on brand</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-2">
            <Logo variant="icon" size={24} />
            <figcaption className="text-caption text-ink-muted">24px</figcaption>
          </figure>
        </div>
        <div className="flex flex-col gap-3">
          <Wordmark size="lg" />
          <Wordmark size="md" />
          <LogoLockup size={32} />
        </div>
        <p className="text-label font-normal text-ink-muted">
          The extracted mark is white, so on light surfaces it falls back to the full icon. Dark mode shows the mark.
        </p>
      </Card>
      <div className="relative h-[280px] overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <p className="text-label font-normal text-ink-muted">Splash plays once per session, under 1.2s.</p>
          <Button variant="secondary" size="md" block={false} leadingIcon={<Play aria-hidden size={20} strokeWidth={2} />} onClick={replay}>
            Replay splash
          </Button>
        </div>
        <SplashOverlay key={splashKey} show={showSplash} contained />
      </div>
    </Section>
  );
}

function MapStyle() {
  return (
    <Section title="Map">
      <p className="text-label font-normal text-ink-muted">
        Route like the logo&apos;s road, navy hub pins, logo pins for pickup (pulsing) and dropoff, accent live car.
      </p>
      <div className="relative h-[360px] overflow-hidden rounded-card border border-line">
        <BrandMapPreview />
      </div>
    </Section>
  );
}
