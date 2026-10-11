import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";

/** Branded placeholder until the login and OTP flow ships with issue #32. */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+64px)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo variant="mark" size={72} priority />
        <Wordmark size="lg" />
        <p className="text-body text-ink-muted">Every ride under $10. Students only.</p>
      </div>
      <div className="mt-auto rounded-card bg-surface p-4 text-center">
        <p className="text-label font-normal text-ink-muted">Scarletmail sign-in ships with issue #32.</p>
      </div>
    </main>
  );
}
