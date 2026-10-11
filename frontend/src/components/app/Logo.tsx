import { cn } from "@/lib/cn";

/** UniHop wordmark: brand mark + ink type. Brand red is reserved for the logo and live moments. */
export function Logo({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const mark = size === "lg" ? 40 : 28;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden width={mark} height={mark} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="11" fill="var(--brand)" />
        <path d="M13 11v10.5a7 7 0 0 0 14 0V11" fill="none" stroke="var(--on-brand)" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      <span className={cn("font-bold text-ink", size === "lg" ? "text-title" : "text-headline")}>UniHop</span>
    </span>
  );
}
