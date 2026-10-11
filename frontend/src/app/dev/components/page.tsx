"use client";

import { ArrowRight, Banknote, CircleDot, Clock3, MapPin, Plus, Search, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Screen } from "@/components/app/Screen";
import { Logo } from "@/components/app/Logo";
import {
  Badge,
  BottomSheet,
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

/** Every component and variant in one place for design review. Not linked from the app. */
export default function ComponentsPage() {
  return (
    <Screen title="Components" subtitle="UniHop design system, DESIGN.md section 6">
      <div className="flex flex-col gap-10">
        <BackendStatus />
        <Tokens />
        <Typography />
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
        <Sheet />
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
          <Logo />
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

const TOKENS = ["bg", "surface", "surface-raised", "ink", "ink-muted", "line", "brand", "brand-soft", "success", "warning", "danger"];

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

function Typography() {
  return (
    <Section title="Typography">
      <div className="flex flex-col gap-2">
        <p className="tnum text-display">$6.50</p>
        <p className="text-title">Where to?</p>
        <p className="text-headline">Alex Kim</p>
        <p className="text-body">Your driver is 2 minutes away.</p>
        <p className="text-label">Pickup</p>
        <p className="text-caption text-ink-muted">Today, 9:41 AM</p>
      </div>
    </Section>
  );
}

function Buttons() {
  const [loading, setLoading] = useState(false);
  return (
    <Section title="Button">
      <div className="flex flex-col gap-3">
        <Button variant="brand">Request UniHop</Button>
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
        <Button variant="brand" disabledReason="Pick a dropoff first.">
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
          trailing={<Switch aria-label="Use UniHop Cash" checked={cash} onChange={setCash} tone="brand" />}
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

function Sheet() {
  const [snap, setSnap] = useState(1);
  return (
    <Section title="BottomSheet">
      <p className="text-label font-normal text-ink-muted">Drag or flick the sheet. Snap: {["peek", "half", "full"][snap]}.</p>
      <div
        className="relative h-[560px] overflow-hidden rounded-card border border-line bg-surface"
        style={{
          backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        <BottomSheet
          aria-label="Ride options"
          snapPoints={[140, "55%", "100%"]}
          defaultSnap={1}
          onSnapChange={setSnap}
          header={<h3 className="text-title">Where to?</h3>}
        >
          <div className="-mx-3 flex flex-col gap-1">
            {["The Yard", "Busch Student Center", "Livingston Student Center", "Cook Campus Center", "Douglass Student Center", "New Brunswick Station"].map((h) => (
              <ListRow key={h} leading={<MapPin aria-hidden size={20} strokeWidth={2} />} title={h} subtitle="Hub" chevron onClick={() => {}} />
            ))}
          </div>
          <Button variant="brand" className="mt-4">
            Request UniHop
          </Button>
        </BottomSheet>
      </div>
    </Section>
  );
}
